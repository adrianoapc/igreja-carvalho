-- ============================================================================
-- F1 — CORE financeiro no banco: RPCs canônicas fin_* de lançamento (ADR-029)
--
-- Toda escrita em transacoes_financeiras / transferencias_contas passa a ter
-- porta de entrada única. Convenções (ADR-029):
--   · prefixo fin_; escalares para o essencial + p_extras jsonb; retorno
--     jsonb {ok, id(s), warnings[]}; auditoria em fin_audit_log.
--   · resolução de tenant/ator: JWT (frontend) ou p_contexto (service role).
--   · SECURITY DEFINER: validação de tenant é inegociável.
--
-- Decisões aplicadas:
--   D4  — lançamento conciliado (conciliado_extrato/conciliado_bot) não pode
--         ser editado, excluído nem ter status alterado; desconciliar antes.
--   D6  — parcelado materializa TODAS as parcelas na criação (corrige o bug
--         da parcela única); recorrente é materializado por job diário.
--   D8  — status padronizado como TEXT + CHECK (pendente|pago|cancelado);
--         enum nativo descartado (migração cara, ganho marginal).
--
-- Semântica de saldo (paridade com produção):
--   · INSERT com status='pago' NÃO altera contas.saldo_atual (o trigger
--     atualizar_saldo_conta é AFTER UPDATE OF status) — comportamento atual
--     de TransacaoDialog e bot, mantido.
--   · Transferência ajusta saldos das duas contas na criação (semântica do
--     bot, adotada como canônica; a UI não ajustava — drift documentado).
--   · Estorno de transferência cancela as transações via UPDATE e deixa o
--     trigger reverter o saldo UMA vez (corrige o estorno em dobro da UI).
--   · fin_recalcular_saldo_conta permite corrigir drift histórico.
-- ============================================================================

-- ─── 1. Coluna de vínculo entre irmãs (parcelas/ocorrências) ────────────────

ALTER TABLE public.transacoes_financeiras
  ADD COLUMN IF NOT EXISTS lancamento_pai_id uuid
    REFERENCES public.transacoes_financeiras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_lancamento_pai
  ON public.transacoes_financeiras(lancamento_pai_id)
  WHERE lancamento_pai_id IS NOT NULL;

COMMENT ON COLUMN public.transacoes_financeiras.lancamento_pai_id IS
  'Vincula parcelas 2..N e ocorrências recorrentes ao lançamento origem (D6/ADR-029)';

-- ─── 2. Auditoria ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL,
  filial_id uuid,
  rpc text NOT NULL,
  canal text NOT NULL,
  ator_profile_id uuid,
  ator_user_id uuid,
  entidade text,
  entidade_id uuid,
  payload jsonb,
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_audit_log_igreja_data
  ON public.fin_audit_log(igreja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_audit_log_entidade
  ON public.fin_audit_log(entidade, entidade_id);

ALTER TABLE public.fin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_audit_log_select" ON public.fin_audit_log;
CREATE POLICY "fin_audit_log_select" ON public.fin_audit_log
  FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id)
  );
-- Escrita apenas via RPCs SECURITY DEFINER (nenhuma policy de INSERT).

COMMENT ON TABLE public.fin_audit_log IS
  'Trilha quem/quando/canal de toda RPC fin_* (ADR-029). Escrita só via RPC.';

-- ─── 3. Resolução de tenant e ator (padrão obrigatório do ADR-029) ─────────

CREATE OR REPLACE FUNCTION public.fin_resolver_contexto(
  p_contexto jsonb DEFAULT NULL,
  p_flag_bot text DEFAULT NULL   -- coluna de profiles exigida p/ canal bot
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_service boolean := COALESCE(auth.jwt() ->> 'role', '') = 'service_role' AND auth.uid() IS NULL;
  v_igreja uuid;
  v_filial uuid;
  v_profile record;
  v_canal text;
  v_flag_ok boolean;
BEGIN
  IF v_uid IS NOT NULL THEN
    -- Canal frontend: tenant derivado do JWT; permissão de tesouraria.
    IF NOT (has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'tesoureiro'::app_role)) THEN
      RAISE EXCEPTION 'FIN_SEM_PERMISSAO: requer papel admin ou tesoureiro';
    END IF;

    v_igreja := public.get_current_user_igreja_id();
    IF v_igreja IS NULL THEN
      RAISE EXCEPTION 'FIN_TENANT: igreja não resolvida a partir do JWT';
    END IF;

    -- Tenant explícito no p_contexto é validado contra o JWT (nunca confiado).
    IF p_contexto ? 'igreja_id'
       AND (p_contexto ->> 'igreja_id')::uuid IS DISTINCT FROM v_igreja
       AND NOT has_role(v_uid, 'admin'::app_role) THEN
      RAISE EXCEPTION 'FIN_TENANT: igreja_id do contexto diverge do JWT';
    END IF;

    IF p_contexto ? 'filial_id' AND p_contexto ->> 'filial_id' IS NOT NULL THEN
      v_filial := (p_contexto ->> 'filial_id')::uuid;
      IF NOT public.has_filial_access(v_igreja, v_filial) THEN
        RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
      END IF;
    ELSE
      v_filial := public.get_current_user_filial_id();
    END IF;

    SELECT id INTO v_profile FROM public.profiles WHERE user_id = v_uid LIMIT 1;

    RETURN jsonb_build_object(
      'igreja_id', v_igreja,
      'filial_id', v_filial,
      'ator_profile_id', v_profile.id,
      'ator_user_id', v_uid,
      'canal', COALESCE(p_contexto ->> 'canal', 'web')
    );
  END IF;

  IF v_is_service THEN
    -- Canal service role (bot/edges): p_contexto obrigatório e validado.
    IF p_contexto IS NULL
       OR NOT (p_contexto ? 'igreja_id')
       OR NOT (p_contexto ? 'ator_profile_id')
       OR NOT (p_contexto ? 'canal') THEN
      RAISE EXCEPTION 'FIN_CONTEXTO: service role exige p_contexto {igreja_id, ator_profile_id, canal}';
    END IF;

    v_igreja := (p_contexto ->> 'igreja_id')::uuid;
    v_filial := NULLIF(p_contexto ->> 'filial_id', '')::uuid;
    v_canal  := p_contexto ->> 'canal';

    SELECT id, user_id, igreja_id, autorizado_bot_financeiro,
           autorizado_lancar_despesas, autorizado_lancar_depositos,
           autorizado_lancar_reembolsos
      INTO v_profile
      FROM public.profiles
     WHERE id = (p_contexto ->> 'ator_profile_id')::uuid
     LIMIT 1;

    IF v_profile.id IS NULL OR v_profile.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_CONTEXTO: ator não pertence ao tenant informado';
    END IF;

    IF v_canal = 'bot' THEN
      IF NOT COALESCE(v_profile.autorizado_bot_financeiro, false) THEN
        RAISE EXCEPTION 'FIN_BOT: ator não autorizado no bot financeiro';
      END IF;
      IF p_flag_bot IS NOT NULL THEN
        v_flag_ok := CASE p_flag_bot
          WHEN 'autorizado_lancar_despesas'  THEN COALESCE(v_profile.autorizado_lancar_despesas, false)
          WHEN 'autorizado_lancar_depositos' THEN COALESCE(v_profile.autorizado_lancar_depositos, false)
          WHEN 'autorizado_lancar_reembolsos' THEN COALESCE(v_profile.autorizado_lancar_reembolsos, false)
          ELSE false
        END;
        IF NOT v_flag_ok THEN
          RAISE EXCEPTION 'FIN_BOT: ator sem a permissão % no bot financeiro', p_flag_bot;
        END IF;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'igreja_id', v_igreja,
      'filial_id', v_filial,
      'ator_profile_id', v_profile.id,
      'ator_user_id', v_profile.user_id,
      'canal', v_canal
    );
  END IF;

  RAISE EXCEPTION 'FIN_AUTH: chamada sem JWT de usuário nem service role';
END;
$$;

COMMENT ON FUNCTION public.fin_resolver_contexto IS
  'Resolve tenant/ator/canal para as RPCs fin_* (ADR-029 §convenção 4). JWT: tenant do token + papel admin|tesoureiro. Service role: p_contexto validado; canal bot checa flags de profiles.';

-- ─── 4. Validação de FK dentro do tenant ────────────────────────────────────

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
                      'sessoes_contagem','solicitacoes_reembolso','formas_pagamento') THEN
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

-- ─── 5. Registro de auditoria ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_registrar_auditoria(
  p_ctx jsonb,
  p_rpc text,
  p_entidade text,
  p_entidade_id uuid,
  p_payload jsonb,
  p_resultado jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fin_audit_log
    (igreja_id, filial_id, rpc, canal, ator_profile_id, ator_user_id,
     entidade, entidade_id, payload, resultado)
  VALUES
    ((p_ctx ->> 'igreja_id')::uuid,
     NULLIF(p_ctx ->> 'filial_id', '')::uuid,
     p_rpc,
     COALESCE(p_ctx ->> 'canal', 'desconhecido'),
     NULLIF(p_ctx ->> 'ator_profile_id', '')::uuid,
     NULLIF(p_ctx ->> 'ator_user_id', '')::uuid,
     p_entidade, p_entidade_id, p_payload, p_resultado);
END;
$$;

-- ─── 6. fin_criar_lancamento ────────────────────────────────────────────────
-- Substitui os inserts diretos de TransacaoDialog, chatbot-financeiro e
-- QuickCreateTransacaoDialog. Materializa parcelas (D6).
--
-- p_extras (todos opcionais):
--   subcategoria_id, centro_custo_id, base_ministerial_id, fornecedor_id,
--   forma_pagamento (text), data_competencia, data_pagamento, status
--   (pendente|pago), juros, multas, desconto, taxas_administrativas,
--   valor_liquido (se ausente: valor + juros + multas + taxas − desconto),
--   observacoes, anexo_url, pessoa_id, sessao_id, solicitacao_reembolso_id,
--   origem_registro, tipo_lancamento (unico|parcelado|recorrente),
--   total_parcelas, recorrencia, data_fim_recorrencia, lancado_por (uuid)

CREATE OR REPLACE FUNCTION public.fin_criar_lancamento(
  p_tipo text,
  p_valor numeric,
  p_data_vencimento date,
  p_conta_id uuid,
  p_descricao text,
  p_categoria_id uuid DEFAULT NULL,
  p_extras jsonb DEFAULT '{}'::jsonb,
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
  v_status text;
  v_tipo_lancamento text;
  v_total_parcelas int;
  v_juros numeric; v_multas numeric; v_desconto numeric; v_taxas numeric;
  v_liquido numeric;
  v_data_pagamento date;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_pai uuid;
  v_warnings text[] := '{}';
  v_parcela int;
  v_venc date;
  v_flag text;
BEGIN
  IF p_tipo NOT IN ('entrada','saida') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: tipo deve ser entrada|saida';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: valor deve ser positivo';
  END IF;
  IF p_data_vencimento IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: data_vencimento obrigatória';
  END IF;

  v_flag := CASE WHEN p_tipo = 'saida'
                 THEN 'autorizado_lancar_despesas'
                 ELSE 'autorizado_lancar_depositos' END;
  v_ctx := public.fin_resolver_contexto(p_contexto, v_flag);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  -- filial explícita do chamador tem precedência (ex.: "todas as filiais" = null)
  IF p_extras ? 'filial_id' THEN
    v_filial := NULLIF(p_extras ->> 'filial_id', '')::uuid;
    IF v_filial IS NOT NULL AND (v_ctx ->> 'canal') = 'web'
       AND NOT public.has_filial_access(v_igreja, v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', p_categoria_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(p_extras ->> 'subcategoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(p_extras ->> 'centro_custo_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(p_extras ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('fornecedores', NULLIF(p_extras ->> 'fornecedor_id','')::uuid, v_igreja);

  v_status := COALESCE(p_extras ->> 'status', 'pendente');
  IF v_status NOT IN ('pendente','pago') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status inicial deve ser pendente|pago';
  END IF;

  v_tipo_lancamento := COALESCE(p_extras ->> 'tipo_lancamento', 'unico');
  IF v_tipo_lancamento NOT IN ('unico','parcelado','recorrente') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: tipo_lancamento inválido';
  END IF;

  -- ADR-027: juros/multas só existem quando pago; desconto/taxas sempre.
  v_desconto := COALESCE((p_extras ->> 'desconto')::numeric, 0);
  v_taxas    := COALESCE((p_extras ->> 'taxas_administrativas')::numeric, 0);
  v_juros    := CASE WHEN v_status = 'pago' THEN COALESCE((p_extras ->> 'juros')::numeric, 0) ELSE 0 END;
  v_multas   := CASE WHEN v_status = 'pago' THEN COALESCE((p_extras ->> 'multas')::numeric, 0) ELSE 0 END;
  v_liquido  := COALESCE((p_extras ->> 'valor_liquido')::numeric,
                         p_valor + v_juros + v_multas + v_taxas - v_desconto);
  v_data_pagamento := CASE WHEN v_status = 'pago'
                           THEN COALESCE((p_extras ->> 'data_pagamento')::date, p_data_vencimento)
                           ELSE NULL END;

  v_total_parcelas := CASE WHEN v_tipo_lancamento = 'parcelado'
                           THEN GREATEST(COALESCE((p_extras ->> 'total_parcelas')::int, 1), 1)
                           ELSE NULL END;

  FOR v_parcela IN 1 .. COALESCE(v_total_parcelas, 1) LOOP
    v_venc := p_data_vencimento + make_interval(months => v_parcela - 1);

    INSERT INTO public.transacoes_financeiras (
      tipo, tipo_lancamento, descricao, valor, valor_liquido,
      data_vencimento, data_competencia, data_pagamento,
      conta_id, categoria_id, subcategoria_id, centro_custo_id,
      base_ministerial_id, fornecedor_id, forma_pagamento,
      total_parcelas, numero_parcela, recorrencia, data_fim_recorrencia,
      observacoes, anexo_url, lancado_por, status,
      juros, multas, desconto, taxas_administrativas,
      pessoa_id, sessao_id, solicitacao_reembolso_id,
      origem_registro, lancamento_pai_id, igreja_id, filial_id
    ) VALUES (
      p_tipo, v_tipo_lancamento,
      CASE WHEN v_total_parcelas IS NOT NULL AND v_total_parcelas > 1
           THEN p_descricao || ' (' || v_parcela || '/' || v_total_parcelas || ')'
           ELSE p_descricao END,
      p_valor,
      -- parcelas futuras nascem pendentes: líquido sem juros/multas
      CASE WHEN v_parcela = 1 THEN v_liquido
           ELSE p_valor + v_taxas - v_desconto END,
      v_venc,
      COALESCE((p_extras ->> 'data_competencia')::date, v_venc),
      CASE WHEN v_parcela = 1 THEN v_data_pagamento ELSE NULL END,
      p_conta_id, p_categoria_id,
      NULLIF(p_extras ->> 'subcategoria_id','')::uuid,
      NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
      NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
      NULLIF(p_extras ->> 'fornecedor_id','')::uuid,
      NULLIF(p_extras ->> 'forma_pagamento',''),
      v_total_parcelas,
      CASE WHEN v_tipo_lancamento = 'parcelado' THEN v_parcela ELSE NULL END,
      CASE WHEN v_tipo_lancamento = 'recorrente' THEN p_extras ->> 'recorrencia' ELSE NULL END,
      CASE WHEN v_tipo_lancamento = 'recorrente' THEN (p_extras ->> 'data_fim_recorrencia')::date ELSE NULL END,
      NULLIF(p_extras ->> 'observacoes',''),
      NULLIF(p_extras ->> 'anexo_url',''),
      COALESCE(NULLIF(p_extras ->> 'lancado_por','')::uuid, (v_ctx ->> 'ator_user_id')::uuid),
      CASE WHEN v_parcela = 1 THEN v_status ELSE 'pendente' END,
      CASE WHEN v_parcela = 1 THEN v_juros ELSE 0 END,
      CASE WHEN v_parcela = 1 THEN v_multas ELSE 0 END,
      v_desconto, v_taxas,
      NULLIF(p_extras ->> 'pessoa_id','')::uuid,
      NULLIF(p_extras ->> 'sessao_id','')::uuid,
      NULLIF(p_extras ->> 'solicitacao_reembolso_id','')::uuid,
      COALESCE(NULLIF(p_extras ->> 'origem_registro',''), 'manual'),
      v_pai, v_igreja, v_filial
    )
    RETURNING id INTO v_id;

    IF v_parcela = 1 THEN v_pai := v_id; END IF;
    v_ids := v_ids || v_id;
  END LOOP;

  IF v_total_parcelas IS NOT NULL AND v_total_parcelas > 1 THEN
    v_warnings := v_warnings ||
      format('Materializadas %s parcelas mensais a partir de %s (D6)', v_total_parcelas, p_data_vencimento);
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_criar_lancamento', 'transacoes_financeiras', v_pai,
    jsonb_build_object('tipo', p_tipo, 'valor', p_valor,
                       'data_vencimento', p_data_vencimento,
                       'conta_id', p_conta_id, 'categoria_id', p_categoria_id,
                       'extras', p_extras),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'id', v_pai,
                            'ids', to_jsonb(v_ids),
                            'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 7. fin_atualizar_lancamento ────────────────────────────────────────────
-- Substitui os updates diretos do TransacaoDialog (edição).
-- p_patch: apenas campos permitidos são aplicados; demais são ignorados com
-- warning. Recalcula valor_liquido (ADR-027) quando componentes mudam e o
-- chamador não fixou valor_liquido explicitamente.

CREATE OR REPLACE FUNCTION public.fin_atualizar_lancamento(
  p_id uuid,
  p_patch jsonb,
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
  v_atual public.transacoes_financeiras%ROWTYPE;
  v_warnings text[] := '{}';
  v_permitidos text[] := ARRAY[
    'tipo','tipo_lancamento','descricao','valor','valor_liquido',
    'data_vencimento','data_competencia','data_pagamento',
    'conta_id','categoria_id','subcategoria_id','centro_custo_id',
    'base_ministerial_id','fornecedor_id','forma_pagamento',
    'total_parcelas','numero_parcela','recorrencia','data_fim_recorrencia',
    'observacoes','anexo_url','status','juros','multas','desconto',
    'taxas_administrativas','pessoa_id','filial_id','lancado_por'
  ];
  v_campo text;
  v_aplicar jsonb := '{}'::jsonb;
  v_novo_status text;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  -- D4: conciliado é imutável até desconciliar.
  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser editado (D4); desconcilie antes';
  END IF;

  FOR v_campo IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_campo = ANY (v_permitidos) THEN
      v_aplicar := v_aplicar || jsonb_build_object(v_campo, p_patch -> v_campo);
    ELSE
      v_warnings := v_warnings || format('campo %s ignorado', v_campo);
    END IF;
  END LOOP;

  -- Valida FKs alteradas dentro do tenant
  PERFORM public.fin_validar_fk_tenant('contas', NULLIF(v_aplicar ->> 'conta_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(v_aplicar ->> 'categoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(v_aplicar ->> 'subcategoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(v_aplicar ->> 'centro_custo_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(v_aplicar ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('fornecedores', NULLIF(v_aplicar ->> 'fornecedor_id','')::uuid, v_igreja);

  v_novo_status := COALESCE(v_aplicar ->> 'status', v_atual.status);
  IF v_novo_status NOT IN ('pendente','pago','cancelado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status inválido (%)', v_novo_status;
  END IF;

  -- ADR-027: recalcula valor_liquido quando componentes mudam sem fixação explícita.
  IF NOT (v_aplicar ? 'valor_liquido')
     AND (v_aplicar ?| ARRAY['valor','juros','multas','desconto','taxas_administrativas']) THEN
    v_aplicar := v_aplicar || jsonb_build_object('valor_liquido',
        COALESCE((v_aplicar ->> 'valor')::numeric, v_atual.valor)
      + COALESCE((v_aplicar ->> 'juros')::numeric, v_atual.juros, 0)
      + COALESCE((v_aplicar ->> 'multas')::numeric, v_atual.multas, 0)
      + COALESCE((v_aplicar ->> 'taxas_administrativas')::numeric, v_atual.taxas_administrativas, 0)
      - COALESCE((v_aplicar ->> 'desconto')::numeric, v_atual.desconto, 0));
  END IF;

  UPDATE public.transacoes_financeiras SET
    tipo                 = COALESCE(v_aplicar ->> 'tipo', tipo),
    tipo_lancamento      = COALESCE(v_aplicar ->> 'tipo_lancamento', tipo_lancamento),
    descricao            = COALESCE(v_aplicar ->> 'descricao', descricao),
    valor                = COALESCE((v_aplicar ->> 'valor')::numeric, valor),
    valor_liquido        = CASE WHEN v_aplicar ? 'valor_liquido'
                                THEN (v_aplicar ->> 'valor_liquido')::numeric ELSE valor_liquido END,
    data_vencimento      = COALESCE((v_aplicar ->> 'data_vencimento')::date, data_vencimento),
    data_competencia     = CASE WHEN v_aplicar ? 'data_competencia'
                                THEN NULLIF(v_aplicar ->> 'data_competencia','')::date ELSE data_competencia END,
    data_pagamento       = CASE WHEN v_aplicar ? 'data_pagamento'
                                THEN NULLIF(v_aplicar ->> 'data_pagamento','')::date ELSE data_pagamento END,
    conta_id             = COALESCE(NULLIF(v_aplicar ->> 'conta_id','')::uuid, conta_id),
    categoria_id         = CASE WHEN v_aplicar ? 'categoria_id'
                                THEN NULLIF(v_aplicar ->> 'categoria_id','')::uuid ELSE categoria_id END,
    subcategoria_id      = CASE WHEN v_aplicar ? 'subcategoria_id'
                                THEN NULLIF(v_aplicar ->> 'subcategoria_id','')::uuid ELSE subcategoria_id END,
    centro_custo_id      = CASE WHEN v_aplicar ? 'centro_custo_id'
                                THEN NULLIF(v_aplicar ->> 'centro_custo_id','')::uuid ELSE centro_custo_id END,
    base_ministerial_id  = CASE WHEN v_aplicar ? 'base_ministerial_id'
                                THEN NULLIF(v_aplicar ->> 'base_ministerial_id','')::uuid ELSE base_ministerial_id END,
    fornecedor_id        = CASE WHEN v_aplicar ? 'fornecedor_id'
                                THEN NULLIF(v_aplicar ->> 'fornecedor_id','')::uuid ELSE fornecedor_id END,
    forma_pagamento      = CASE WHEN v_aplicar ? 'forma_pagamento'
                                THEN NULLIF(v_aplicar ->> 'forma_pagamento','') ELSE forma_pagamento END,
    total_parcelas       = CASE WHEN v_aplicar ? 'total_parcelas'
                                THEN NULLIF(v_aplicar ->> 'total_parcelas','')::int ELSE total_parcelas END,
    numero_parcela       = CASE WHEN v_aplicar ? 'numero_parcela'
                                THEN NULLIF(v_aplicar ->> 'numero_parcela','')::int ELSE numero_parcela END,
    recorrencia          = CASE WHEN v_aplicar ? 'recorrencia'
                                THEN NULLIF(v_aplicar ->> 'recorrencia','') ELSE recorrencia END,
    data_fim_recorrencia = CASE WHEN v_aplicar ? 'data_fim_recorrencia'
                                THEN NULLIF(v_aplicar ->> 'data_fim_recorrencia','')::date ELSE data_fim_recorrencia END,
    observacoes          = CASE WHEN v_aplicar ? 'observacoes'
                                THEN NULLIF(v_aplicar ->> 'observacoes','') ELSE observacoes END,
    anexo_url            = CASE WHEN v_aplicar ? 'anexo_url'
                                THEN NULLIF(v_aplicar ->> 'anexo_url','') ELSE anexo_url END,
    status               = v_novo_status,
    juros                = COALESCE((v_aplicar ->> 'juros')::numeric, juros),
    multas               = COALESCE((v_aplicar ->> 'multas')::numeric, multas),
    desconto             = COALESCE((v_aplicar ->> 'desconto')::numeric, desconto),
    taxas_administrativas = COALESCE((v_aplicar ->> 'taxas_administrativas')::numeric, taxas_administrativas),
    pessoa_id            = CASE WHEN v_aplicar ? 'pessoa_id'
                                THEN NULLIF(v_aplicar ->> 'pessoa_id','')::uuid ELSE pessoa_id END,
    filial_id            = CASE WHEN v_aplicar ? 'filial_id'
                                THEN NULLIF(v_aplicar ->> 'filial_id','')::uuid ELSE filial_id END,
    lancado_por          = COALESCE(NULLIF(v_aplicar ->> 'lancado_por','')::uuid, lancado_por),
    updated_at           = now()
  WHERE id = p_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_atualizar_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('patch', p_patch),
    jsonb_build_object('status_antes', v_atual.status, 'status_depois', v_novo_status));

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 8. fin_alterar_status_lancamento ───────────────────────────────────────
-- Única porta pendente↔pago↔cancelado (substitui TransacaoActionsMenu e
-- ConfirmarPagamentoDialog). O trigger de saldo permanece o executor da
-- atualização de contas.saldo_atual.
-- p_dados: {data_pagamento, juros, multas, desconto, taxas_administrativas}

CREATE OR REPLACE FUNCTION public.fin_alterar_status_lancamento(
  p_id uuid,
  p_novo_status text,
  p_dados jsonb DEFAULT '{}'::jsonb,
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
  v_atual public.transacoes_financeiras%ROWTYPE;
  v_warnings text[] := '{}';
BEGIN
  IF p_novo_status NOT IN ('pendente','pago','cancelado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status deve ser pendente|pago|cancelado';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: status de lançamento conciliado não pode mudar (D4); desconcilie antes';
  END IF;

  IF v_atual.status = p_novo_status THEN
    v_warnings := v_warnings || 'status já era o solicitado; nenhuma mudança';
    RETURN jsonb_build_object('ok', true, 'id', p_id, 'warnings', to_jsonb(v_warnings));
  END IF;

  IF p_novo_status = 'pendente' THEN
    -- Paridade com ActionsMenu: voltar a pendente limpa dados de pagamento.
    UPDATE public.transacoes_financeiras SET
      status = 'pendente', data_pagamento = NULL,
      juros = 0, multas = 0, desconto = 0, taxas_administrativas = 0,
      updated_at = now()
    WHERE id = p_id;
  ELSIF p_novo_status = 'pago' THEN
    UPDATE public.transacoes_financeiras SET
      status = 'pago',
      data_pagamento = COALESCE((p_dados ->> 'data_pagamento')::date, CURRENT_DATE),
      juros  = COALESCE((p_dados ->> 'juros')::numeric, juros, 0),
      multas = COALESCE((p_dados ->> 'multas')::numeric, multas, 0),
      desconto = COALESCE((p_dados ->> 'desconto')::numeric, desconto, 0),
      taxas_administrativas = COALESCE((p_dados ->> 'taxas_administrativas')::numeric, taxas_administrativas, 0),
      valor_liquido = valor
        + COALESCE((p_dados ->> 'juros')::numeric, juros, 0)
        + COALESCE((p_dados ->> 'multas')::numeric, multas, 0)
        + COALESCE((p_dados ->> 'taxas_administrativas')::numeric, taxas_administrativas, 0)
        - COALESCE((p_dados ->> 'desconto')::numeric, desconto, 0),
      updated_at = now()
    WHERE id = p_id;
  ELSE
    UPDATE public.transacoes_financeiras SET
      status = 'cancelado', updated_at = now()
    WHERE id = p_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_alterar_status_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('de', v_atual.status, 'para', p_novo_status, 'dados', p_dados),
    NULL);

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 9. fin_excluir_lancamento ──────────────────────────────────────────────
-- Recusa conciliado (D4). p_extras.escopo: 'somente_este' (default) ou
-- 'este_e_futuras' (irmãs de parcelamento/recorrência ainda pendentes).

CREATE OR REPLACE FUNCTION public.fin_excluir_lancamento(
  p_id uuid,
  p_extras jsonb DEFAULT '{}'::jsonb,
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
  v_atual public.transacoes_financeiras%ROWTYPE;
  v_escopo text := COALESCE(p_extras ->> 'escopo', 'somente_este');
  v_ids uuid[] := '{}';
  v_warnings text[] := '{}';
  v_pai uuid;
  v_irmas int;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser excluído (D4); desconcilie antes';
  END IF;

  IF v_atual.status = 'pago' THEN
    v_warnings := v_warnings ||
      'lançamento pago excluído; saldo da conta não é recalculado automaticamente (use fin_recalcular_saldo_conta se necessário)';
  END IF;

  IF v_escopo = 'este_e_futuras' THEN
    v_pai := COALESCE(v_atual.lancamento_pai_id, v_atual.id);
    WITH del AS (
      DELETE FROM public.transacoes_financeiras
       WHERE igreja_id = v_igreja
         AND (id = p_id
              OR ((lancamento_pai_id = v_pai OR id = v_pai)
                  AND data_vencimento >= v_atual.data_vencimento
                  AND status = 'pendente'
                  AND conciliacao_status NOT IN ('conciliado_extrato','conciliado_bot')))
      RETURNING id
    )
    SELECT array_agg(id) INTO v_ids FROM del;
  ELSE
    DELETE FROM public.transacoes_financeiras WHERE id = p_id;
    v_ids := ARRAY[p_id];

    SELECT count(*) INTO v_irmas FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja
       AND (lancamento_pai_id = COALESCE(v_atual.lancamento_pai_id, v_atual.id)
            OR id = v_atual.lancamento_pai_id);
    IF v_irmas > 0 THEN
      v_warnings := v_warnings ||
        format('%s parcela(s)/ocorrência(s) irmã(s) permanecem; use escopo este_e_futuras para remover as futuras', v_irmas);
    END IF;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_excluir_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('escopo', v_escopo,
                       'snapshot', to_jsonb(v_atual)),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 10. fin_criar_transferencia ────────────────────────────────────────────
-- Par transferencias_contas + 2 transações espelho + ajuste de saldo, atômico.
-- p_extras: categoria_saida_id, categoria_entrada_id, subcategoria_saida_id,
--   base_ministerial_id, centro_custo_id, descricao_saida, descricao_entrada,
--   forma_pagamento, observacoes, anexo_url, sessao_bot_id, criado_por (uuid)

CREATE OR REPLACE FUNCTION public.fin_criar_transferencia(
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor numeric,
  p_data date,
  p_extras jsonb DEFAULT '{}'::jsonb,
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
  v_transf uuid;
  v_tx_saida uuid;
  v_tx_entrada uuid;
  v_nome_origem text;
  v_nome_destino text;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: valor deve ser positivo';
  END IF;
  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: contas de origem e destino devem ser diferentes';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, 'autorizado_lancar_depositos');
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;
  IF p_extras ? 'filial_id' THEN
    v_filial := NULLIF(p_extras ->> 'filial_id', '')::uuid;
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_origem_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('contas', p_conta_destino_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_saida_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid, v_igreja);

  SELECT nome INTO v_nome_origem FROM public.contas WHERE id = p_conta_origem_id;
  SELECT nome INTO v_nome_destino FROM public.contas WHERE id = p_conta_destino_id;

  INSERT INTO public.transferencias_contas (
    conta_origem_id, conta_destino_id, valor,
    data_transferencia, data_competencia, observacoes, anexo_url,
    igreja_id, filial_id, status, criado_por, sessao_id
  ) VALUES (
    p_conta_origem_id, p_conta_destino_id, p_valor,
    p_data, p_data,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    v_igreja, v_filial, 'executada',
    COALESCE(NULLIF(p_extras ->> 'criado_por','')::uuid, (v_ctx ->> 'ator_profile_id')::uuid),
    NULLIF(p_extras ->> 'sessao_bot_id','')::uuid
  ) RETURNING id INTO v_transf;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor,
    data_vencimento, data_pagamento, data_competencia, status,
    forma_pagamento, conta_id, categoria_id, subcategoria_id,
    base_ministerial_id, centro_custo_id, transferencia_id,
    observacoes, anexo_url, lancado_por, igreja_id, filial_id
  ) VALUES (
    'saida', 'unico',
    COALESCE(NULLIF(p_extras ->> 'descricao_saida',''),
             'Transferência para ' || COALESCE(v_nome_destino, 'outra conta')),
    p_valor, p_data, p_data, p_data, 'pago',
    COALESCE(NULLIF(p_extras ->> 'forma_pagamento',''), 'Transferência Bancária'),
    p_conta_origem_id,
    NULLIF(p_extras ->> 'categoria_saida_id','')::uuid,
    NULLIF(p_extras ->> 'subcategoria_saida_id','')::uuid,
    NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
    NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
    v_transf,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    (v_ctx ->> 'ator_user_id')::uuid,
    v_igreja, v_filial
  ) RETURNING id INTO v_tx_saida;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor,
    data_vencimento, data_pagamento, data_competencia, status,
    forma_pagamento, conta_id, categoria_id,
    base_ministerial_id, centro_custo_id, transferencia_id,
    observacoes, anexo_url, lancado_por, igreja_id, filial_id
  ) VALUES (
    'entrada', 'unico',
    COALESCE(NULLIF(p_extras ->> 'descricao_entrada',''),
             'Transferência de ' || COALESCE(v_nome_origem, 'outra conta')),
    p_valor, p_data, p_data, p_data, 'pago',
    COALESCE(NULLIF(p_extras ->> 'forma_pagamento',''), 'Transferência Bancária'),
    p_conta_destino_id,
    NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid,
    NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
    NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
    v_transf,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    (v_ctx ->> 'ator_user_id')::uuid,
    v_igreja, v_filial
  ) RETURNING id INTO v_tx_entrada;

  UPDATE public.transferencias_contas
     SET transacao_saida_id = v_tx_saida,
         transacao_entrada_id = v_tx_entrada,
         updated_at = now()
   WHERE id = v_transf;

  -- Semântica canônica (do bot): transferência move saldo imediatamente.
  -- O trigger de saldo não dispara em INSERT, então o ajuste é explícito.
  UPDATE public.contas SET saldo_atual = saldo_atual - p_valor, updated_at = now()
   WHERE id = p_conta_origem_id;
  UPDATE public.contas SET saldo_atual = saldo_atual + p_valor, updated_at = now()
   WHERE id = p_conta_destino_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_criar_transferencia', 'transferencias_contas', v_transf,
    jsonb_build_object('conta_origem_id', p_conta_origem_id,
                       'conta_destino_id', p_conta_destino_id,
                       'valor', p_valor, 'data', p_data, 'extras', p_extras),
    jsonb_build_object('transacao_saida_id', v_tx_saida,
                       'transacao_entrada_id', v_tx_entrada));

  RETURN jsonb_build_object('ok', true, 'id', v_transf,
                            'transacao_saida_id', v_tx_saida,
                            'transacao_entrada_id', v_tx_entrada,
                            'warnings', '[]'::jsonb);
END;
$$;

-- ─── 11. fin_estornar_transferencia ─────────────────────────────────────────
-- Inverso exato: cancela as transações espelho via UPDATE (o trigger
-- atualizar_saldo_conta reverte o saldo UMA vez) e marca a transferência.
-- Corrige o estorno em dobro do frontend (trigger + ajuste manual).

CREATE OR REPLACE FUNCTION public.fin_estornar_transferencia(
  p_transferencia_id uuid,
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
  v_transf public.transferencias_contas%ROWTYPE;
  v_warnings text[] := '{}';
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_transf FROM public.transferencias_contas
   WHERE id = p_transferencia_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: transferência % fora do tenant ou inexistente', p_transferencia_id;
  END IF;
  IF v_transf.status = 'estornada' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: transferência já estornada';
  END IF;

  -- Bloqueia estorno se alguma perna estiver conciliada (D4).
  IF EXISTS (
    SELECT 1 FROM public.transacoes_financeiras
     WHERE transferencia_id = p_transferencia_id
       AND conciliacao_status IN ('conciliado_extrato','conciliado_bot')
  ) THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: transferência com perna conciliada não pode ser estornada (D4)';
  END IF;

  -- pago → cancelado dispara o trigger de saldo (reversão única e correta).
  UPDATE public.transacoes_financeiras
     SET status = 'cancelado', updated_at = now()
   WHERE transferencia_id = p_transferencia_id
     AND status = 'pago';

  UPDATE public.transferencias_contas
     SET status = 'estornada', updated_at = now()
   WHERE id = p_transferencia_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_estornar_transferencia', 'transferencias_contas', p_transferencia_id,
    NULL,
    jsonb_build_object('transacao_saida_id', v_transf.transacao_saida_id,
                       'transacao_entrada_id', v_transf.transacao_entrada_id));

  RETURN jsonb_build_object('ok', true, 'id', p_transferencia_id,
                            'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 12. fin_ajustar_saldo ──────────────────────────────────────────────────
-- Substitui o UPDATE direto de contas.saldo_atual do AjusteSaldoDialog por um
-- lançamento auditável. O saldo é movido pelo trigger (INSERT pendente →
-- UPDATE pago), preservando o executor único de saldo.

CREATE OR REPLACE FUNCTION public.fin_ajustar_saldo(
  p_conta_id uuid,
  p_valor numeric,
  p_tipo text,               -- entrada | saida
  p_motivo text DEFAULT NULL,
  p_data date DEFAULT CURRENT_DATE,
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
  v_categoria uuid;
  v_id uuid;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: valor deve ser positivo';
  END IF;
  IF p_tipo NOT IN ('entrada','saida') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: tipo deve ser entrada|saida';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);

  -- Categoria dedicada por igreja/tipo (criada sob demanda).
  SELECT id INTO v_categoria FROM public.categorias_financeiras
   WHERE igreja_id = v_igreja AND nome = 'Ajuste de Saldo' AND tipo = p_tipo
   LIMIT 1;
  IF v_categoria IS NULL THEN
    INSERT INTO public.categorias_financeiras (nome, tipo, igreja_id, filial_id)
    VALUES ('Ajuste de Saldo', p_tipo, v_igreja, NULL)
    RETURNING id INTO v_categoria;
  END IF;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor, valor_liquido,
    data_vencimento, data_competencia, status,
    conta_id, categoria_id, observacoes, lancado_por,
    origem_registro, igreja_id, filial_id
  ) VALUES (
    p_tipo, 'unico',
    'Ajuste de saldo' || COALESCE(' — ' || NULLIF(p_motivo, ''), ''),
    p_valor, p_valor,
    p_data, p_data, 'pendente',
    p_conta_id, v_categoria,
    NULLIF(p_motivo, ''),
    (v_ctx ->> 'ator_user_id')::uuid,
    'ajuste', v_igreja, v_filial
  ) RETURNING id INTO v_id;

  -- pendente → pago move o saldo via trigger (executor único).
  UPDATE public.transacoes_financeiras
     SET status = 'pago', data_pagamento = p_data, updated_at = now()
   WHERE id = v_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_ajustar_saldo', 'contas', p_conta_id,
    jsonb_build_object('valor', p_valor, 'tipo', p_tipo,
                       'motivo', p_motivo, 'data', p_data),
    jsonb_build_object('transacao_id', v_id));

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'warnings', '[]'::jsonb);
END;
$$;

-- ─── 13. fin_recalcular_saldo_conta ─────────────────────────────────────────
-- Utilitário para corrigir drift histórico (risco §11 do doc de arquitetura):
-- saldo = saldo_inicial + Σ entradas pagas − Σ saídas pagas.

CREATE OR REPLACE FUNCTION public.fin_recalcular_saldo_conta(
  p_conta_id uuid,
  p_aplicar boolean DEFAULT false,
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
  v_conta public.contas%ROWTYPE;
  v_calculado numeric;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_conta FROM public.contas
   WHERE id = p_conta_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: conta % fora do tenant ou inexistente', p_conta_id;
  END IF;

  SELECT COALESCE(v_conta.saldo_inicial, 0)
       + COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0)
    INTO v_calculado
    FROM public.transacoes_financeiras
   WHERE conta_id = p_conta_id AND status = 'pago';

  IF p_aplicar THEN
    UPDATE public.contas
       SET saldo_atual = v_calculado, updated_at = now()
     WHERE id = p_conta_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_recalcular_saldo_conta', 'contas', p_conta_id,
    jsonb_build_object('aplicar', p_aplicar),
    jsonb_build_object('saldo_registrado', v_conta.saldo_atual,
                       'saldo_calculado', v_calculado));

  RETURN jsonb_build_object('ok', true, 'id', p_conta_id,
                            'saldo_registrado', v_conta.saldo_atual,
                            'saldo_calculado', v_calculado,
                            'aplicado', p_aplicar,
                            'warnings', '[]'::jsonb);
END;
$$;

-- ─── 14. Materialização de recorrentes (D6) ─────────────────────────────────
-- Job diário: para cada lançamento recorrente "cabeça", cria a próxima
-- ocorrência quando a última materializada está a menos de 60 dias.

CREATE OR REPLACE FUNCTION public.fin_materializar_recorrencias()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cabeca record;
  v_ultima date;
  v_proxima date;
  v_intervalo interval;
  v_criadas int := 0;
BEGIN
  FOR v_cabeca IN
    SELECT * FROM public.transacoes_financeiras
     WHERE tipo_lancamento = 'recorrente'
       AND lancamento_pai_id IS NULL
       AND (data_fim_recorrencia IS NULL OR data_fim_recorrencia >= CURRENT_DATE)
  LOOP
    v_intervalo := CASE lower(COALESCE(v_cabeca.recorrencia, 'mensal'))
      WHEN 'diaria'     THEN interval '1 day'
      WHEN 'semanal'    THEN interval '7 days'
      WHEN 'quinzenal'  THEN interval '15 days'
      WHEN 'mensal'     THEN interval '1 month'
      WHEN 'bimestral'  THEN interval '2 months'
      WHEN 'trimestral' THEN interval '3 months'
      WHEN 'semestral'  THEN interval '6 months'
      WHEN 'anual'      THEN interval '1 year'
      ELSE interval '1 month'
    END;

    SELECT COALESCE(MAX(data_vencimento), v_cabeca.data_vencimento)
      INTO v_ultima
      FROM public.transacoes_financeiras
     WHERE lancamento_pai_id = v_cabeca.id OR id = v_cabeca.id;

    v_proxima := (v_ultima + v_intervalo)::date;

    WHILE v_proxima <= CURRENT_DATE + interval '60 days'
          AND (v_cabeca.data_fim_recorrencia IS NULL OR v_proxima <= v_cabeca.data_fim_recorrencia)
    LOOP
      INSERT INTO public.transacoes_financeiras (
        tipo, tipo_lancamento, descricao, valor, valor_liquido,
        data_vencimento, data_competencia, status,
        conta_id, categoria_id, subcategoria_id, centro_custo_id,
        base_ministerial_id, fornecedor_id, forma_pagamento,
        recorrencia, data_fim_recorrencia, observacoes,
        lancado_por, origem_registro, lancamento_pai_id,
        igreja_id, filial_id, desconto, taxas_administrativas
      ) VALUES (
        v_cabeca.tipo, 'recorrente', v_cabeca.descricao, v_cabeca.valor,
        v_cabeca.valor + COALESCE(v_cabeca.taxas_administrativas, 0) - COALESCE(v_cabeca.desconto, 0),
        v_proxima, v_proxima, 'pendente',
        v_cabeca.conta_id, v_cabeca.categoria_id, v_cabeca.subcategoria_id,
        v_cabeca.centro_custo_id, v_cabeca.base_ministerial_id,
        v_cabeca.fornecedor_id, v_cabeca.forma_pagamento,
        v_cabeca.recorrencia, v_cabeca.data_fim_recorrencia, v_cabeca.observacoes,
        v_cabeca.lancado_por, v_cabeca.origem_registro, v_cabeca.id,
        v_cabeca.igreja_id, v_cabeca.filial_id,
        COALESCE(v_cabeca.desconto, 0), COALESCE(v_cabeca.taxas_administrativas, 0)
      );
      v_criadas := v_criadas + 1;
      v_proxima := (v_proxima + v_intervalo)::date;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ocorrencias_criadas', v_criadas);
END;
$$;

COMMENT ON FUNCTION public.fin_materializar_recorrencias IS
  'Job (pg_cron diário) que materializa ocorrências de lançamentos recorrentes até 60 dias à frente (D6/ADR-029)';

-- Agenda diária 03:15 UTC (se pg_cron estiver disponível; idempotente).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('fin-materializar-recorrencias')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-materializar-recorrencias');
    PERFORM cron.schedule(
      'fin-materializar-recorrencias',
      '15 3 * * *',
      $$SELECT public.fin_materializar_recorrencias()$$
    );
  END IF;
END;
$do$;

-- ─── 15. Grants ─────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.fin_resolver_contexto(jsonb, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fin_validar_fk_tenant(text, uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fin_registrar_auditoria(jsonb, text, text, uuid, jsonb, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fin_materializar_recorrencias() FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fin_criar_lancamento(text, numeric, date, uuid, text, uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_atualizar_lancamento(uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_alterar_status_lancamento(uuid, text, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_excluir_lancamento(uuid, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_criar_transferencia(uuid, uuid, numeric, date, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_estornar_transferencia(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_ajustar_saldo(uuid, numeric, text, text, date, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_recalcular_saldo_conta(uuid, boolean, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fin_criar_lancamento(text, numeric, date, uuid, text, uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_atualizar_lancamento(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_alterar_status_lancamento(uuid, text, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_excluir_lancamento(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_criar_transferencia(uuid, uuid, numeric, date, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_estornar_transferencia(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_ajustar_saldo(uuid, numeric, text, text, date, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_recalcular_saldo_conta(uuid, boolean, jsonb) FROM anon;
