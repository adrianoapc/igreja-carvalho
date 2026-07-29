-- ============================================================================
-- Importação do Recebível Extrato Detalhado (portal Getnet) — Fase A (ADR-029)
--
-- SFTP da Getnet ficou indisponível num período; usuário baixa manualmente do
-- portal o CSV "Recebível Extrato Detalhado" (layout diferente do EDI
-- posicional e do CSV genérico legado). Esta fase só IMPORTA e agrupa por
-- Contrato Registradora (lote de antecipação) — vínculo com extrato bancário
-- e lançamento de deságio ficam para a Fase B, após validar com dado real.
--
-- Convenção fin_*: SECURITY DEFINER, fin_resolver_contexto/fin_validar_fk_
-- tenant/fin_registrar_auditoria, RLS igreja_id+filial_id+user_filial_access
-- (NÃO o padrão antigo has_role()/get_current_user_igreja_id() usado em
-- getnet_resumo/getnet_financeiro_resumo) — ver fin_extrato_ingestao_jobs
-- como referência (20260712120000_fin_ingerir_extratos.sql).
--
-- Dedupe: dedupe_key = md5(colunas naturais da linha) + contador de ocorrência
-- dentro do lote de import — mesmo padrão do dedupe Santander (PR #56) e do
-- external_id `file:...#occ` do ImportarExtratosTab. Necessário porque o CSV
-- real tem linhas "Saldo Anterior" genuinamente duplicadas.
--
-- Desvio deliberado do desenho original: `getnet_antecipacao_lotes.
-- contrato_registradora` é UNIQUE (igreja_id, contrato_registradora), não
-- UNIQUE global — evita que o upsert de um lote (via SECURITY DEFINER, que
-- bypassa RLS) atualize a linha de outro tenant caso dois números de contrato
-- algum dia colidam entre igrejas diferentes.
-- ============================================================================

-- ─── 1. fin_extrato_ingestao_jobs: conta_id passa a ser opcional ───────────
-- Job de importação do Recebível não tem uma "conta bancária" associada (é um
-- lote da Getnet, não um extrato de conta) — só faz sentido preencher quando a
-- origem for de fato um extrato de conta (arquivo_ofx/csv/xlsx, api_santander
-- etc.). Reaproveitar a tabela exige relaxar essa constraint.
ALTER TABLE public.fin_extrato_ingestao_jobs
  ALTER COLUMN conta_id DROP NOT NULL;

COMMENT ON COLUMN public.fin_extrato_ingestao_jobs.conta_id IS
  'Conta bancária de destino do lote; NULL para origens sem conta associada (ex.: getnet_recebivel_portal, ligado a uma integração, não a uma conta).';

-- ─── 2. getnet_recebivel_lancamentos ────────────────────────────────────────
-- Uma linha por linha do CSV "Recebível Extrato Detalhado" (exceto Subtotal,
-- que é derivável por soma e não precisa ser armazenado).

CREATE TABLE IF NOT EXISTS public.getnet_recebivel_lancamentos (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id               uuid        NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id                   uuid        NOT NULL,
  filial_id                   uuid,
  import_job_id               uuid        REFERENCES public.fin_extrato_ingestao_jobs(id) ON DELETE SET NULL,

  data_vencimento             date,
  bandeira_modalidade         text,
  tipo_lancamento             text,
  lancamento                  text,
  valor_liquido                numeric(14,2),
  valor_liquidado              numeric(14,2),

  numero_cartao               text,
  autorizacao                 text,
  nsu                          text,
  terminal_logico              text,

  data_venda                  date,
  hora_venda                  text,
  valor_venda                 numeric(14,2),
  parcelas                    text,        -- formato bruto do portal, ex. "1 de 7" (parcela atual de N)
  valor_parcela                numeric(14,2),
  descontos                   numeric(14,2),
  valor_liquido_parcela         numeric(14,2),

  data_contratacao_contrato    date,
  instituicao_negociadora      text,
  contrato_registradora        text,
  valor_atual_contrato          numeric(14,2),
  valor_liquidado_contrato      numeric(14,2),
  valor_a_liquidar_contrato     numeric(14,2),

  dedupe_key                  text        NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT getnet_recebivel_lancamentos_dedupe UNIQUE (integracao_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_getnet_recebivel_lanc_int_venc
  ON public.getnet_recebivel_lancamentos(integracao_id, data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_getnet_recebivel_lanc_contrato
  ON public.getnet_recebivel_lancamentos(contrato_registradora)
  WHERE contrato_registradora IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_getnet_recebivel_lanc_job
  ON public.getnet_recebivel_lancamentos(import_job_id)
  WHERE import_job_id IS NOT NULL;

ALTER TABLE public.getnet_recebivel_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "getnet_recebivel_lancamentos_select" ON public.getnet_recebivel_lancamentos;
-- Mesmo padrão de fin_extrato_ingestao_jobs: papel amplo recortado por igreja
-- OU papel restrito (tesoureiro/admin_filial) + escopo de filial (própria,
-- linha de igreja inteira via filial_id NULL, ou grant explícito).
CREATE POLICY "getnet_recebivel_lancamentos_select" ON public.getnet_recebivel_lancamentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
         AND (ur.igreja_id = getnet_recebivel_lancamentos.igreja_id OR ur.igreja_id IS NULL)
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = auth.uid()
           AND ur.role::text IN ('tesoureiro', 'admin_filial')
           AND ur.igreja_id = getnet_recebivel_lancamentos.igreja_id
      )
      AND (
        getnet_recebivel_lancamentos.filial_id IS NULL
        OR getnet_recebivel_lancamentos.filial_id = public.get_current_user_filial_id()
        OR EXISTS (
          SELECT 1 FROM public.user_filial_access ufa
           WHERE ufa.user_id = auth.uid()
             AND ufa.filial_id = getnet_recebivel_lancamentos.filial_id
             AND ufa.can_view = true
        )
      )
    )
  );
-- Escrita apenas via fin_importar_recebivel_getnet (SECURITY DEFINER).

COMMENT ON TABLE public.getnet_recebivel_lancamentos IS
  'Linhas do CSV "Recebível Extrato Detalhado" (portal Getnet), importadas via fin_importar_recebivel_getnet. Fase A: só importação/agrupamento; vínculo com extrato bancário e lançamento de deságio são Fase B.';

-- ─── 3. getnet_antecipacao_lotes ────────────────────────────────────────────
-- Um row por Contrato Registradora, upsert automático durante a importação
-- (Valor Atual Do Contrato é um valor fixo repetido em toda linha do mesmo
-- contrato, não precisa de soma).

CREATE TABLE IF NOT EXISTS public.getnet_antecipacao_lotes (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id               uuid        NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id                   uuid        NOT NULL,
  filial_id                   uuid,

  contrato_registradora        text        NOT NULL,
  instituicao_negociadora      text,
  data_contratacao_contrato    date,
  valor_atual_contrato          numeric(14,2),

  extrato_bancario_id          uuid        REFERENCES public.extratos_bancarios(id),          -- vínculo manual (Fase B)
  lancamento_desagio_id        uuid        REFERENCES public.transacoes_financeiras(id),       -- após lançar (Fase B)
  status                       text        NOT NULL DEFAULT 'pendente_vinculo'
                                             CHECK (status IN ('pendente_vinculo','vinculado','lancamento_criado')),

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT getnet_antecipacao_lotes_unique UNIQUE (igreja_id, contrato_registradora)
);

CREATE INDEX IF NOT EXISTS idx_getnet_antecipacao_lotes_status
  ON public.getnet_antecipacao_lotes(igreja_id, status);

ALTER TABLE public.getnet_antecipacao_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "getnet_antecipacao_lotes_select" ON public.getnet_antecipacao_lotes;
CREATE POLICY "getnet_antecipacao_lotes_select" ON public.getnet_antecipacao_lotes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
         AND (ur.igreja_id = getnet_antecipacao_lotes.igreja_id OR ur.igreja_id IS NULL)
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = auth.uid()
           AND ur.role::text IN ('tesoureiro', 'admin_filial')
           AND ur.igreja_id = getnet_antecipacao_lotes.igreja_id
      )
      AND (
        getnet_antecipacao_lotes.filial_id IS NULL
        OR getnet_antecipacao_lotes.filial_id = public.get_current_user_filial_id()
        OR EXISTS (
          SELECT 1 FROM public.user_filial_access ufa
           WHERE ufa.user_id = auth.uid()
             AND ufa.filial_id = getnet_antecipacao_lotes.filial_id
             AND ufa.can_view = true
        )
      )
    )
  );
-- Escrita apenas via RPCs SECURITY DEFINER (fin_importar_recebivel_getnet cria/
-- atualiza; fin_vincular_lote_antecipacao/fin_lancar_desagio_antecipacao, Fase
-- B, ainda não implementadas).

COMMENT ON TABLE public.getnet_antecipacao_lotes IS
  'Um row por Contrato Registradora (lote de antecipação), upsert automático em fin_importar_recebivel_getnet. Vínculo com extrato bancário e lançamento de deságio são Fase B.';

-- ─── 4. fin_validar_fk_tenant: permite validar integracoes_financeiras ─────
CREATE OR REPLACE FUNCTION public.fin_validar_fk_tenant(
  p_tabela text,
  p_id uuid,
  p_igreja_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_id IS NULL THEN RETURN; END IF;

  IF p_tabela NOT IN ('contas','categorias_financeiras','subcategorias_financeiras',
                      'centros_custo','bases_ministeriais','fornecedores',
                      'transacoes_financeiras','transferencias_contas',
                      'sessoes_contagem','solicitacoes_reembolso','formas_pagamento',
                      'integracoes_financeiras') THEN
    RAISE EXCEPTION 'FIN_FK: tabela % não suportada', p_tabela;
  END IF;

  EXECUTE format(
    'SELECT EXISTS(SELECT 1 FROM public.%I WHERE id = $1 AND igreja_id = $2)',
    p_tabela
  ) INTO v_ok USING p_id, p_igreja_id;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'FIN_FK: % (%) inexistente ou fora do tenant', p_tabela, p_id;
  END IF;
END;
$$;

-- ─── 5. fin_importar_recebivel_getnet ───────────────────────────────────────
-- p_linhas: array de objetos com as chaves das colunas de
-- getnet_recebivel_lancamentos (data_vencimento, bandeira_modalidade,
-- tipo_lancamento, lancamento, valor_liquido, valor_liquidado, numero_cartao,
-- autorizacao, nsu, terminal_logico, data_venda, hora_venda, valor_venda,
-- parcelas, valor_parcela, descontos, valor_liquido_parcela,
-- data_contratacao_contrato, instituicao_negociadora, contrato_registradora,
-- valor_atual_contrato, valor_liquidado_contrato, valor_a_liquidar_contrato).
-- Linhas com tipo_lancamento='Subtotal' são ignoradas (deriváveis por soma).

CREATE OR REPLACE FUNCTION public.fin_importar_recebivel_getnet(
  p_integracao_id uuid,
  p_linhas jsonb,
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
  v_integracao record;
  v_pode_todas boolean;
  v_job_id uuid;
  v_total int;
  v_inseridos int := 0;
  v_duplicados int := 0;
  v_subtotal_ignoradas int := 0;
  v_invalidos int := 0;
  v_warnings text[] := '{}';
  v_ocorrencias jsonb := '{}'::jsonb;
  v_item jsonb;
  v_tipo_lanc text;
  v_data_vencimento date;
  v_bandeira text;
  v_lancamento text;
  v_nsu text;
  v_valor_liquido numeric;
  v_data_venda date;
  v_chave text;
  v_ocorrencia int;
  v_dedupe_key text;
  v_contrato text;
  v_valor_atual_contrato numeric;
  v_novo boolean;
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

  -- Integração no tenant + provedor getnet (SECURITY DEFINER bypassa RLS).
  SELECT id, igreja_id, filial_id, provedor INTO v_integracao
    FROM public.integracoes_financeiras WHERE id = p_integracao_id;
  IF v_integracao.id IS NULL OR v_integracao.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: integração inexistente ou fora do tenant';
  END IF;
  IF v_integracao.provedor <> 'getnet' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: integração % não é do provedor getnet', p_integracao_id;
  END IF;
  IF NOT (
       v_pode_todas
       OR v_integracao.filial_id IS NULL
       OR v_integracao.filial_id IS NOT DISTINCT FROM v_filial
       OR (auth.uid() IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.user_filial_access ufa
              WHERE ufa.user_id = auth.uid()
                AND ufa.filial_id = v_integracao.filial_id
                AND ufa.can_view = true))
     ) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da integração';
  END IF;

  -- Auditoria/job refletem a filial da INTEGRAÇÃO, não o default do contexto.
  v_ctx := v_ctx || jsonb_build_object('filial_id', v_integracao.filial_id);

  v_total := COALESCE(jsonb_array_length(p_linhas), 0);
  IF v_total = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: nenhuma linha para importar';
  END IF;

  INSERT INTO public.fin_extrato_ingestao_jobs
    (igreja_id, filial_id, conta_id, origem, total_itens, ator_profile_id, canal)
  VALUES
    (v_igreja, v_integracao.filial_id, NULL, 'getnet_recebivel_portal', v_total,
     NULLIF(v_ctx ->> 'ator_profile_id','')::uuid, v_ctx ->> 'canal')
  RETURNING id INTO v_job_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    -- Isola cada linha: uma linha malformada não derruba o lote inteiro.
    BEGIN
      v_tipo_lanc := COALESCE(v_item ->> 'tipo_lancamento', '');
      IF lower(v_tipo_lanc) = 'subtotal' THEN
        v_subtotal_ignoradas := v_subtotal_ignoradas + 1;
        CONTINUE;
      END IF;

      v_data_vencimento := NULLIF(v_item ->> 'data_vencimento', '')::date;
      v_bandeira := NULLIF(v_item ->> 'bandeira_modalidade', '');
      v_lancamento := NULLIF(v_item ->> 'lancamento', '');
      v_nsu := NULLIF(v_item ->> 'nsu', '');
      v_valor_liquido := NULLIF(v_item ->> 'valor_liquido', '')::numeric;
      v_data_venda := NULLIF(v_item ->> 'data_venda', '')::date;
      -- "0" é o sentinel do portal pra "sem contrato" (visto em Pagamento
      -- Realizado/Valor Liquidado (R$)) — não é um Contrato Registradora real.
      v_contrato := NULLIF(NULLIF(v_item ->> 'contrato_registradora', ''), '0');
      v_valor_atual_contrato := NULLIF(v_item ->> 'valor_atual_contrato', '')::numeric;

      -- Chave natural + contador de ocorrência dentro do lote (mesmo padrão
      -- do dedupe Santander/PR#56): linhas "Saldo Anterior" genuinamente
      -- duplicadas no CSV real não podem ser descartadas como falso positivo.
      v_chave := COALESCE(v_data_vencimento::text, '') || '|' || COALESCE(v_bandeira, '') || '|' ||
                 v_tipo_lanc || '|' || COALESCE(v_lancamento, '') || '|' ||
                 COALESCE(v_nsu, '') || '|' || COALESCE(v_valor_liquido::text, '') || '|' ||
                 COALESCE(v_data_venda::text, '');
      v_ocorrencia := COALESCE((v_ocorrencias ->> v_chave)::int, 0);
      v_ocorrencias := v_ocorrencias || jsonb_build_object(v_chave, v_ocorrencia + 1);
      v_dedupe_key := md5(v_chave || '#' || v_ocorrencia);

      INSERT INTO public.getnet_recebivel_lancamentos (
        integracao_id, igreja_id, filial_id, import_job_id,
        data_vencimento, bandeira_modalidade, tipo_lancamento, lancamento,
        valor_liquido, valor_liquidado,
        numero_cartao, autorizacao, nsu, terminal_logico,
        data_venda, hora_venda, valor_venda, parcelas, valor_parcela,
        descontos, valor_liquido_parcela,
        data_contratacao_contrato, instituicao_negociadora, contrato_registradora,
        valor_atual_contrato, valor_liquidado_contrato, valor_a_liquidar_contrato,
        dedupe_key
      ) VALUES (
        p_integracao_id, v_igreja, v_integracao.filial_id, v_job_id,
        v_data_vencimento, v_bandeira, v_tipo_lanc, v_lancamento,
        v_valor_liquido, NULLIF(v_item ->> 'valor_liquidado', '')::numeric,
        NULLIF(v_item ->> 'numero_cartao', ''), NULLIF(v_item ->> 'autorizacao', ''),
        v_nsu, NULLIF(v_item ->> 'terminal_logico', ''),
        v_data_venda, NULLIF(v_item ->> 'hora_venda', ''),
        NULLIF(v_item ->> 'valor_venda', '')::numeric,
        NULLIF(v_item ->> 'parcelas', ''),
        NULLIF(v_item ->> 'valor_parcela', '')::numeric,
        NULLIF(v_item ->> 'descontos', '')::numeric,
        NULLIF(v_item ->> 'valor_liquido_parcela', '')::numeric,
        NULLIF(v_item ->> 'data_contratacao_contrato', '')::date,
        NULLIF(v_item ->> 'instituicao_negociadora', ''),
        v_contrato,
        v_valor_atual_contrato,
        NULLIF(v_item ->> 'valor_liquidado_contrato', '')::numeric,
        NULLIF(v_item ->> 'valor_a_liquidar_contrato', '')::numeric,
        v_dedupe_key
      )
      ON CONFLICT (integracao_id, dedupe_key) DO NOTHING;

      GET DIAGNOSTICS v_novo = ROW_COUNT;
      IF v_novo THEN v_inseridos := v_inseridos + 1;
      ELSE v_duplicados := v_duplicados + 1; END IF;

      -- Upsert de lote por Contrato Registradora (Valor Atual Do Contrato é
      -- fixo repetido em toda linha do mesmo contrato — sobrescrever é seguro
      -- e idempotente; status NÃO é tocado para não reverter progresso da
      -- Fase B num reimport).
      IF v_contrato IS NOT NULL THEN
        INSERT INTO public.getnet_antecipacao_lotes (
          integracao_id, igreja_id, filial_id, contrato_registradora,
          instituicao_negociadora, data_contratacao_contrato, valor_atual_contrato
        ) VALUES (
          p_integracao_id, v_igreja, v_integracao.filial_id, v_contrato,
          NULLIF(v_item ->> 'instituicao_negociadora', ''),
          NULLIF(v_item ->> 'data_contratacao_contrato', '')::date,
          v_valor_atual_contrato
        )
        ON CONFLICT (igreja_id, contrato_registradora) DO UPDATE SET
          valor_atual_contrato = EXCLUDED.valor_atual_contrato,
          instituicao_negociadora = EXCLUDED.instituicao_negociadora,
          data_contratacao_contrato = EXCLUDED.data_contratacao_contrato,
          updated_at = now();
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_invalidos := v_invalidos + 1;
      v_warnings := v_warnings || left(SQLERRM, 120);
    END;
  END LOOP;

  UPDATE public.fin_extrato_ingestao_jobs
     SET inseridos = v_inseridos, duplicados = v_duplicados
   WHERE id = v_job_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_importar_recebivel_getnet', 'getnet_recebivel_lancamentos', v_job_id,
    jsonb_build_object('integracao_id', p_integracao_id, 'total', v_total),
    jsonb_build_object('job_id', v_job_id, 'inseridos', v_inseridos,
                       'duplicados', v_duplicados, 'invalidos', v_invalidos,
                       'subtotal_ignoradas', v_subtotal_ignoradas));

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id, 'total', v_total,
                            'inseridos', v_inseridos, 'duplicados', v_duplicados,
                            'invalidos', v_invalidos, 'subtotal_ignoradas', v_subtotal_ignoradas,
                            'warnings', to_jsonb(v_warnings));
END;
$$;

COMMENT ON FUNCTION public.fin_importar_recebivel_getnet(uuid, jsonb, jsonb) IS
  'Importa o CSV "Recebível Extrato Detalhado" (portal Getnet): dedupe por (integracao_id, dedupe_key) com contador de ocorrência, upsert de getnet_antecipacao_lotes por Contrato Registradora, job em fin_extrato_ingestao_jobs (origem getnet_recebivel_portal). Fase A — sem vínculo com extrato bancário nem lançamento de deságio.';

-- ─── 6. Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fin_importar_recebivel_getnet(uuid, jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_importar_recebivel_getnet(uuid, jsonb, jsonb) FROM anon;
