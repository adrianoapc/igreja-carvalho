-- ============================================================================
-- F5 — Pipeline de ingestão de extratos (ADR-022/ADR-028/ADR-029)
--
-- Porta ÚNICA de ingestão de extratos bancários: `fin_ingerir_extratos` recebe
-- um lote de itens (contrato ExtratoItem) e faz, num só lugar: validação de
-- tenant/filial, normalização (valor ABS + direção em `tipo`), dedupe por
-- `(conta_id, external_id)` — gerando `external_id` determinístico quando o
-- provedor não fornece (corrige o bug de reimportação do canal manual, que
-- gravava `external_id` NULL e duplicava) — job de rastreabilidade e auditoria.
-- `fin_desfazer_ingestao` remove os extratos NÃO conciliados de um job (undo),
-- preservando os já conciliados.
--
-- Substitui, nesta fatia, o INSERT client-side de ImportarExtratosTab (OFX/CSV/
-- XLSX). Santander/Getnet/PIX migram em increments seguintes (mesma porta).
--
-- Decisão D-F5 (valor canônico): a porta grava SEMPRE `valor = abs(valor)` e a
-- direção fica em `tipo` (credito/debito) — alinha com santander-api e com o
-- motor de score F4 (compara `e.valor = t.valor`). Só governa NOVA ingestão;
-- linhas históricas assinadas permanecem.
--
-- Depende de F1 (fin_resolver_contexto, fin_registrar_auditoria) e da tabela
-- extratos_bancarios (índice único (conta_id, external_id)).
-- ============================================================================

-- ─── 1. Job de ingestão (rastreabilidade + undo) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_extrato_ingestao_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL,
  filial_id uuid,
  conta_id uuid NOT NULL,
  origem text NOT NULL,
  total_itens integer NOT NULL DEFAULT 0,
  inseridos integer NOT NULL DEFAULT 0,
  duplicados integer NOT NULL DEFAULT 0,
  desfeito_em timestamptz,
  ator_profile_id uuid,
  canal text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_ingestao_jobs_igreja_data
  ON public.fin_extrato_ingestao_jobs(igreja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_ingestao_jobs_conta
  ON public.fin_extrato_ingestao_jobs(conta_id);

ALTER TABLE public.fin_extrato_ingestao_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_ingestao_jobs_select" ON public.fin_extrato_ingestao_jobs;
CREATE POLICY "fin_ingestao_jobs_select" ON public.fin_extrato_ingestao_jobs
  FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role)
     OR has_role(auth.uid(), 'super_admin'::app_role))
    AND public.has_filial_access(igreja_id, filial_id)
  );
-- Escrita apenas via RPCs SECURITY DEFINER (nenhuma policy de INSERT/UPDATE).

COMMENT ON TABLE public.fin_extrato_ingestao_jobs IS
  'Job de ingestão de extratos (F5): 1 linha por lote de fin_ingerir_extratos; base do undo (fin_desfazer_ingestao) via extratos_bancarios.import_job_id.';

-- ─── 2. fin_ingerir_extratos ────────────────────────────────────────────────
-- p_itens: [ { data_transacao, valor, tipo('credito'|'debito'), descricao,
--             external_id?, numero_documento?, saldo? } ]
-- p_origem: manual|arquivo_ofx|arquivo_csv|arquivo_xlsx|api_santander|
--           getnet_sftp|getnet_sftp_txt|getnet_sftp_tipo5|pix

CREATE OR REPLACE FUNCTION public.fin_ingerir_extratos(
  p_conta_id uuid,
  p_origem text,
  p_itens jsonb,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_filial uuid;
  v_conta record;
  v_pode_todas boolean;
  v_job_id uuid;
  v_total int;
  v_inseridos int := 0;
  v_duplicados int := 0;
  v_item jsonb;
  v_ext_id text;
  v_data date;
  v_valor numeric;
  v_tipo text;
  v_desc text;
  v_novo boolean;
  v_invalidos int := 0;
  v_warnings text[] := '{}';
  v_origens text[] := ARRAY['manual','arquivo_ofx','arquivo_csv','arquivo_xlsx',
                            'api_santander','getnet_sftp','getnet_sftp_txt',
                            'getnet_sftp_tipo5','pix'];
BEGIN
  IF p_origem IS NULL OR NOT (p_origem = ANY(v_origens)) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: origem % inválida', p_origem;
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  -- Papel amplo é POR IGREJA (mesma lógica do motor F4): admin/admin_igreja/
  -- super_admin nesta igreja ingerem em qualquer conta da igreja, mesmo com
  -- filial default no JWT; usuário restrito fica na própria filial.
  v_pode_todas := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
       AND (ur.igreja_id = v_igreja OR ur.igreja_id IS NULL)
  );

  -- Conta no tenant + escopo de filial (SECURITY DEFINER bypassa RLS).
  SELECT id, igreja_id, filial_id INTO v_conta
    FROM public.contas WHERE id = p_conta_id;
  IF v_conta.id IS NULL OR v_conta.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: conta inexistente ou fora do tenant';
  END IF;
  -- Acesso à filial da conta: papel amplo na igreja, filial própria, conta da
  -- igreja (filial NULL) ou grant explícito em user_filial_access — mesmo modelo
  -- da RLS (has_filial_access), mas recortado por igreja: sem o atalho global de
  -- admin do helper (que vaza entre igrejas). Honra o acesso multi-filial.
  IF NOT (
       v_pode_todas
       OR v_conta.filial_id IS NULL
       OR v_conta.filial_id IS NOT DISTINCT FROM v_filial
       OR (auth.uid() IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.user_filial_access ufa
              WHERE ufa.user_id = auth.uid()
                AND ufa.filial_id = v_conta.filial_id
                AND ufa.can_view = true))
     ) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta';
  END IF;

  -- Auditoria/job refletem a filial da CONTA (não o default do contexto), senão
  -- um extrato de filial X geraria audit com filial NULL, visível a outras filiais.
  v_ctx := v_ctx || jsonb_build_object('filial_id', v_conta.filial_id);

  v_total := COALESCE(jsonb_array_length(p_itens), 0);
  IF v_total = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: nenhum item para ingerir';
  END IF;

  INSERT INTO public.fin_extrato_ingestao_jobs
    (igreja_id, filial_id, conta_id, origem, total_itens, ator_profile_id, canal)
  VALUES
    (v_igreja, v_conta.filial_id, p_conta_id, p_origem, v_total,
     NULLIF(v_ctx ->> 'ator_profile_id','')::uuid, v_ctx ->> 'canal')
  RETURNING id INTO v_job_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    -- Isola cada item numa subtransação: um item inválido (data/valor/tipo)
    -- é ignorado com aviso, sem derrubar o lote inteiro — os válidos persistem.
    BEGIN
      IF NULLIF(v_item ->> 'data_transacao','') IS NULL OR NULLIF(v_item ->> 'valor','') IS NULL THEN
        RAISE EXCEPTION 'item sem data_transacao/valor';
      END IF;
      v_tipo := v_item ->> 'tipo';
      IF v_tipo NOT IN ('credito','debito') THEN
        RAISE EXCEPTION 'tipo % inválido', COALESCE(v_tipo,'(nulo)');
      END IF;

      v_data  := (v_item ->> 'data_transacao')::date;
      v_valor := abs((v_item ->> 'valor')::numeric);  -- D-F5: ABS canônico
      v_desc  := COALESCE(v_item ->> 'descricao', '');

      -- external_id do provedor (FITID/transactionId) ou determinístico p/ dedupe
      -- também no manual (md5 é core do Postgres — sem dependência de extensão).
      v_ext_id := COALESCE(
        NULLIF(v_item ->> 'external_id', ''),
        'auto:' || md5(p_conta_id::text || '|' || v_data::text || '|' ||
                       v_valor::text || '|' || v_tipo || '|' || v_desc)
      );

      INSERT INTO public.extratos_bancarios
        (conta_id, igreja_id, filial_id, data_transacao, descricao, valor, saldo,
         numero_documento, tipo, reconciliado, origem, external_id, import_job_id)
      VALUES
        (p_conta_id, v_igreja, v_conta.filial_id, v_data, v_desc, v_valor,
         NULLIF(v_item ->> 'saldo','')::numeric,
         NULLIF(v_item ->> 'numero_documento',''), v_tipo, false, p_origem,
         v_ext_id, v_job_id)
      ON CONFLICT (conta_id, external_id) DO NOTHING;

      GET DIAGNOSTICS v_novo = ROW_COUNT;
      IF v_novo THEN v_inseridos := v_inseridos + 1;
      ELSE v_duplicados := v_duplicados + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_invalidos := v_invalidos + 1;
      v_warnings := v_warnings || left(SQLERRM, 120);
    END;
  END LOOP;

  UPDATE public.fin_extrato_ingestao_jobs
     SET inseridos = v_inseridos, duplicados = v_duplicados
   WHERE id = v_job_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_ingerir_extratos', 'extratos_bancarios', v_job_id,
    jsonb_build_object('origem', p_origem, 'conta_id', p_conta_id, 'total', v_total),
    jsonb_build_object('job_id', v_job_id, 'inseridos', v_inseridos,
                       'duplicados', v_duplicados, 'invalidos', v_invalidos));

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id, 'total', v_total,
                            'inseridos', v_inseridos, 'duplicados', v_duplicados,
                            'invalidos', v_invalidos, 'warnings', to_jsonb(v_warnings));
END;
$$;

COMMENT ON FUNCTION public.fin_ingerir_extratos(uuid, text, jsonb, jsonb) IS
  'Porta única de ingestão de extratos (ADR-028/F5): valida tenant/filial, normaliza valor ABS + tipo, dedupe por (conta_id, external_id) com external_id determinístico quando ausente, job + auditoria.';

-- ─── 3. fin_desfazer_ingestao ───────────────────────────────────────────────
-- Remove os extratos NÃO conciliados de um job; preserva os conciliados
-- (dinheiro já vinculado não pode sumir) e reporta quantos ficaram.

CREATE OR REPLACE FUNCTION public.fin_desfazer_ingestao(
  p_job_id uuid,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_filial uuid;
  v_pode_todas boolean;
  v_job record;
  v_removidos int := 0;
  v_mantidos int := 0;
  v_warnings text[] := '{}';
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;
  v_pode_todas := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
       AND (ur.igreja_id = v_igreja OR ur.igreja_id IS NULL)
  );

  SELECT id, igreja_id, filial_id, desfeito_em INTO v_job
    FROM public.fin_extrato_ingestao_jobs
   WHERE id = p_job_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: job % fora do tenant ou inexistente', p_job_id;
  END IF;
  -- Mesmo modelo de acesso da ingestão: papel amplo, filial própria, job da
  -- igreja (filial NULL) ou grant explícito em user_filial_access — senão um
  -- usuário com grant explícito conseguiria importar mas não desfazer.
  IF NOT (
       v_pode_todas
       OR v_job.filial_id IS NULL
       OR v_job.filial_id IS NOT DISTINCT FROM v_filial
       OR (auth.uid() IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.user_filial_access ufa
              WHERE ufa.user_id = auth.uid()
                AND ufa.filial_id = v_job.filial_id
                AND ufa.can_view = true))
     ) THEN
    RAISE EXCEPTION 'FIN_TENANT: job fora da filial do usuário';
  END IF;

  -- Auditoria reflete a filial do JOB (não o default do contexto do ator) —
  -- mesmo ajuste feito na ingestão: um admin/super_admin com filial default A
  -- desfazendo job da filial B não pode gravar a trilha em A.
  v_ctx := v_ctx || jsonb_build_object('filial_id', v_job.filial_id);

  -- Preserva conciliados (reconciliado ou vinculado a transação).
  SELECT count(*) INTO v_mantidos
    FROM public.extratos_bancarios
   WHERE import_job_id = p_job_id
     AND (reconciliado = true OR transacao_vinculada_id IS NOT NULL);

  WITH del AS (
    DELETE FROM public.extratos_bancarios
     WHERE import_job_id = p_job_id
       AND reconciliado = false
       AND transacao_vinculada_id IS NULL
    RETURNING id
  )
  SELECT count(*) INTO v_removidos FROM del;

  IF v_mantidos > 0 THEN
    v_warnings := v_warnings ||
      format('%s extrato(s) já conciliado(s) preservado(s)', v_mantidos);
  END IF;

  UPDATE public.fin_extrato_ingestao_jobs SET desfeito_em = now() WHERE id = p_job_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_desfazer_ingestao', 'extratos_bancarios', p_job_id, NULL,
    jsonb_build_object('removidos', v_removidos, 'mantidos_conciliados', v_mantidos));

  RETURN jsonb_build_object('ok', true, 'job_id', p_job_id,
                            'removidos', v_removidos, 'mantidos_conciliados', v_mantidos,
                            'warnings', to_jsonb(v_warnings));
END;
$$;

COMMENT ON FUNCTION public.fin_desfazer_ingestao(uuid, jsonb) IS
  'Undo de um job de ingestão (F5): remove extratos não conciliados do job; preserva os conciliados.';

-- ─── 4. Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fin_ingerir_extratos(uuid, text, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_desfazer_ingestao(uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_ingerir_extratos(uuid, text, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_desfazer_ingestao(uuid, jsonb) FROM anon;
