-- ============================================================================
-- F5 fatia 2 — porta de ingestão para adaptadores service-role (ADR-028/029)
--
-- Estende `fin_ingerir_extratos` para o caminho service-role de INTEGRAÇÃO:
-- edges autônomas (getnet-sftp, pix-webhook, santander em modo service) não têm
-- ator humano. Decisão D-F5.2: para `canal = 'integracao'` sem `ator_profile_id`,
-- a RPC valida apenas que a igreja existe e ingere com ator NULL (a auditoria
-- registra o canal). Ingestão é import de dados (não move dinheiro), então
-- relaxar o ator é aceitável — a autz do canal é feita pela própria edge
-- (secret/cert). O caminho JWT (usuário) e o service-role COM ator continuam
-- passando pelo fin_resolver_contexto estrito.
--
-- Substitui (CREATE OR REPLACE) a versão da fatia 1 (20260712120000).
-- ============================================================================

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
  v_is_service boolean := COALESCE(auth.jwt() ->> 'role', '') = 'service_role' AND auth.uid() IS NULL;
  v_integracao boolean;
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

  -- Caminho de integração autônoma (D-F5.2): service role + canal 'integracao'
  -- SEM ator. Valida só a igreja; ator NULL na auditoria.
  v_integracao := v_is_service
                  AND p_contexto IS NOT NULL
                  AND (p_contexto ->> 'canal') = 'integracao'
                  AND NOT (p_contexto ? 'ator_profile_id');

  IF v_integracao THEN
    v_igreja := NULLIF(p_contexto ->> 'igreja_id', '')::uuid;
    IF v_igreja IS NULL OR NOT EXISTS (SELECT 1 FROM public.igrejas WHERE id = v_igreja) THEN
      RAISE EXCEPTION 'FIN_CONTEXTO: igreja inválida para ingestão de integração';
    END IF;
    v_filial := NULLIF(p_contexto ->> 'filial_id', '')::uuid;
    v_ctx := jsonb_build_object('igreja_id', v_igreja, 'filial_id', v_filial,
                                'ator_profile_id', NULL, 'ator_user_id', NULL,
                                'canal', 'integracao');
    v_pode_todas := true;  -- integração opera no escopo da igreja (conta explícita)
  ELSE
    v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
    v_igreja := (v_ctx ->> 'igreja_id')::uuid;
    v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;
    -- Papel amplo por igreja (mesma lógica do motor F4): admin/admin_igreja/
    -- super_admin nesta igreja ingerem em qualquer conta da igreja.
    v_pode_todas := auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()
         AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
         AND (ur.igreja_id = v_igreja OR ur.igreja_id IS NULL)
    );
  END IF;

  -- Conta no tenant + escopo de filial (SECURITY DEFINER bypassa RLS).
  SELECT id, igreja_id, filial_id INTO v_conta
    FROM public.contas WHERE id = p_conta_id;
  IF v_conta.id IS NULL OR v_conta.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: conta inexistente ou fora do tenant';
  END IF;
  -- Acesso à filial da conta: papel amplo na igreja (ou integração), filial
  -- própria, conta da igreja (filial NULL) ou grant explícito em
  -- user_filial_access — mesmo modelo da RLS, recortado por igreja (sem o atalho
  -- global de admin de has_filial_access). Honra o acesso multi-filial.
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
    -- Isola cada item numa subtransação: um item inválido é ignorado com aviso,
    -- sem derrubar o lote — os válidos persistem (crítico para os adaptadores,
    -- onde uma linha malformada do banco não pode anular o sync inteiro).
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
  'Porta única de ingestão de extratos (ADR-028/F5). Caminhos: JWT (usuário) e service-role COM ator via fin_resolver_contexto; service-role canal=integracao SEM ator (D-F5.2, edges autônomas getnet/pix/santander) valida só a igreja. Valor ABS, dedupe (conta_id, external_id) determinístico, job + auditoria.';

GRANT EXECUTE ON FUNCTION public.fin_ingerir_extratos(uuid, text, jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_ingerir_extratos(uuid, text, jsonb, jsonb) FROM anon;
