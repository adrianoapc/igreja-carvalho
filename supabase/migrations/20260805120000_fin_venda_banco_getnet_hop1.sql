-- ============================================================================
-- Fase 3 — Conciliação Cartão Getnet: Hop 1 sem antecipação (Venda ↔ Banco).
--
-- 1) Coluna getnet_recebivel_lancamentos.extrato_bancario_id
--    (independente de transacao_financeira_id — Hop 2).
-- 2) fin_gerar_candidatos_venda_banco_getnet — só leitura.
-- 3) fin_vincular_venda_banco_getnet — grava vínculo + marca
--    extratos_bancarios.reconciliado=true.
--
-- Escopo: contrato_registradora IS NULL (sem lote de antecipação).
-- Agrupa por data_vencimento + filial; Σ líquido casa contra crédito
-- da conta (tipo='credito', reconciliado=false). Não reaproveita
-- fin_gerar_candidatos_conciliacao nem fin_confirmar_conciliacao.
-- ============================================================================

-- ─── 1. Coluna de vínculo Hop 1 ─────────────────────────────────────────────
ALTER TABLE public.getnet_recebivel_lancamentos
  ADD COLUMN IF NOT EXISTS extrato_bancario_id uuid
    REFERENCES public.extratos_bancarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_getnet_recebivel_lanc_extrato
  ON public.getnet_recebivel_lancamentos(extrato_bancario_id)
  WHERE extrato_bancario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_getnet_recebivel_lanc_hop1_livre
  ON public.getnet_recebivel_lancamentos(integracao_id, data_vencimento)
  WHERE extrato_bancario_id IS NULL AND contrato_registradora IS NULL;

COMMENT ON COLUMN public.getnet_recebivel_lancamentos.extrato_bancario_id IS
  'Hop 1 (Venda ↔ Banco): vínculo com extratos_bancarios. Gravado por fin_vincular_venda_banco_getnet (Fase 3); NULL = ainda não liquidado no banco. Independente de transacao_financeira_id (Hop 2).';

-- ─── 2. Candidatos (read-only) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_gerar_candidatos_venda_banco_getnet(
  p_conta_id uuid,
  p_integracao_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_contexto jsonb DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL
)
RETURNS TABLE(
  data_vencimento date,
  filial_id uuid,
  valor_liquido numeric,
  recebivel_ids uuid[],
  extrato_id uuid,
  score numeric,
  features jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_integracao record;
  v_conta record;
  v_scope uuid;
BEGIN
  IF p_conta_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_conta_id é obrigatório';
  END IF;
  IF p_integracao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_integracao_id é obrigatório';
  END IF;
  IF p_periodo_inicio IS NULL OR p_periodo_fim IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_periodo_inicio e p_periodo_fim são obrigatórios';
  END IF;
  IF p_periodo_fim < p_periodo_inicio THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_periodo_fim anterior a p_periodo_inicio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT i.id, i.igreja_id, i.filial_id, i.provedor
    INTO v_integracao
    FROM public.integracoes_financeiras i
   WHERE i.id = p_integracao_id;

  IF v_integracao.id IS NULL OR v_integracao.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: integração inexistente ou fora do tenant';
  END IF;
  IF v_integracao.provedor IS DISTINCT FROM 'getnet' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: integração % não é do provedor getnet', p_integracao_id;
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_integracao.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da integração';
  END IF;

  SELECT c.id, c.igreja_id, c.filial_id
    INTO v_conta
    FROM public.contas c
   WHERE c.id = p_conta_id;

  IF v_conta.id IS NULL OR v_conta.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: conta inexistente ou fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_conta.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta';
  END IF;

  IF p_filial_id IS NOT NULL THEN
    IF NOT public.has_filial_access(v_igreja, p_filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial solicitada';
    END IF;
    v_scope := p_filial_id;
  ELSE
    v_scope := NULL;
  END IF;

  RETURN QUERY
  WITH
  vendas AS (
    SELECT
      g.id,
      g.filial_id,
      g.data_vencimento,
      COALESCE(
        g.valor_liquido_parcela,
        g.valor_liquido,
        COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
      ) AS liquido
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.integracao_id = p_integracao_id
     AND g.igreja_id = v_igreja
     AND g.extrato_bancario_id IS NULL
     AND g.contrato_registradora IS NULL
     AND g.data_vencimento IS NOT NULL
     AND g.data_vencimento BETWEEN p_periodo_inicio AND p_periodo_fim
     AND COALESCE(
           g.valor_liquido_parcela,
           g.valor_liquido,
           COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
         ) IS NOT NULL
     AND public.has_filial_access(v_igreja, g.filial_id)
     AND (
       v_scope IS NULL
       OR g.filial_id IS NULL
       OR g.filial_id = v_scope
     )
  ),
  grupos AS (
    SELECT
      v.data_vencimento,
      v.filial_id,
      SUM(v.liquido) AS valor_liquido,
      array_agg(v.id ORDER BY v.id) AS recebivel_ids
    FROM vendas v
   GROUP BY v.data_vencimento, v.filial_id
  ),
  creditos AS (
    SELECT
      e.id,
      e.filial_id,
      e.data_transacao,
      e.valor,
      e.descricao
    FROM public.extratos_bancarios e
   WHERE e.igreja_id = v_igreja
     AND e.conta_id = p_conta_id
     AND e.tipo = 'credito'
     AND e.reconciliado IS NOT TRUE
     AND e.data_transacao BETWEEN (p_periodo_inicio - 1) AND (p_periodo_fim + 1)
     AND public.has_filial_access(v_igreja, e.filial_id)
     AND (
       v_scope IS NULL
       OR e.filial_id IS NULL
       OR e.filial_id = v_scope
     )
  ),
  matches AS (
    SELECT
      g.data_vencimento,
      g.filial_id,
      g.valor_liquido,
      g.recebivel_ids,
      c.id AS extrato_id,
      CASE
        WHEN c.data_transacao = g.data_vencimento
         AND abs(c.valor - g.valor_liquido) <= 0.01 THEN 1.0::numeric
        WHEN abs(c.data_transacao - g.data_vencimento) = 1
         AND abs(c.valor - g.valor_liquido) <= 0.01 THEN 0.85::numeric
        -- Discrepância de valor sinalizada (visível na UI), score baixo.
        WHEN abs(c.data_transacao - g.data_vencimento) <= 1
         AND abs(c.valor - g.valor_liquido) > 0.01
         AND abs(c.valor - g.valor_liquido) <= GREATEST(1.00, abs(g.valor_liquido) * 0.05)
          THEN 0.50::numeric
        ELSE NULL
      END AS score,
      jsonb_build_object(
        'valor_extrato', c.valor,
        'data_transacao', c.data_transacao,
        'descricao', c.descricao,
        'delta_dias', (c.data_transacao - g.data_vencimento),
        'delta_valor', (c.valor - g.valor_liquido),
        'discrepancia', (abs(c.valor - g.valor_liquido) > 0.01),
        'filial_extrato', c.filial_id,
        'n_recebiveis', coalesce(array_length(g.recebivel_ids, 1), 0)
      ) AS features
    FROM grupos g
    JOIN creditos c
      ON abs(c.data_transacao - g.data_vencimento) <= 1
     AND (c.filial_id IS NULL OR g.filial_id IS NULL OR c.filial_id = g.filial_id)
     AND abs(c.valor - g.valor_liquido) <= GREATEST(1.00, abs(g.valor_liquido) * 0.05)
  )
  SELECT
    m.data_vencimento,
    m.filial_id,
    m.valor_liquido,
    m.recebivel_ids,
    m.extrato_id,
    m.score,
    m.features
  FROM matches m
  WHERE m.score IS NOT NULL
  ORDER BY m.score DESC, m.data_vencimento, m.extrato_id;
END;
$$;

COMMENT ON FUNCTION public.fin_gerar_candidatos_venda_banco_getnet(uuid, uuid, date, date, jsonb, uuid) IS
  'Fase 3 Conciliação Cartão Getnet (Hop 1, só leitura): agrupa getnet_recebivel_lancamentos sem antecipação (contrato_registradora IS NULL) e sem extrato_bancario_id por data_vencimento+filial, soma líquido, casa contra créditos não reconciliados da conta. Discrepância de valor ≤5%/R$1 entra com score 0.5 (sinalizada). has_filial_access em integração, conta, recebível e extrato.';

GRANT EXECUTE ON FUNCTION public.fin_gerar_candidatos_venda_banco_getnet(uuid, uuid, date, date, jsonb, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_venda_banco_getnet(uuid, uuid, date, date, jsonb, uuid)
  FROM anon;

-- ─── 3. Writer Hop 1 ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_vincular_venda_banco_getnet(
  p_extrato_bancario_id uuid,
  p_recebivel_ids uuid[],
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
  v_ext public.extratos_bancarios%ROWTYPE;
  v_rec record;
  v_ids uuid[];
  v_n int;
  v_liquido numeric(14,2) := 0;
  v_filiais_distintas uuid[] := '{}';
  v_tem_filial_compartilhada boolean := false;
  v_warnings text[] := '{}';
  v_delta numeric(14,2);
BEGIN
  IF p_extrato_bancario_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_extrato_bancario_id é obrigatório';
  END IF;
  IF p_recebivel_ids IS NULL OR coalesce(array_length(p_recebivel_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_recebivel_ids não pode ser vazio';
  END IF;

  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_ids
    FROM unnest(p_recebivel_ids) AS x;
  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_recebivel_ids não pode ser vazio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Lock extrato primeiro (id único), depois recebíveis ORDER BY id.
  SELECT * INTO v_ext
    FROM public.extratos_bancarios
   WHERE id = p_extrato_bancario_id
   ORDER BY id
   FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: extrato % inexistente', p_extrato_bancario_id;
  END IF;
  IF v_ext.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_TENANT: extrato fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_ext.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do extrato';
  END IF;
  IF v_ext.tipo IS DISTINCT FROM 'credito' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário selecionado não é um crédito';
  END IF;
  IF v_ext.reconciliado IS TRUE THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato já reconciliado';
  END IF;

  -- Âncora de filial: extrato entra no conjunto (guardrail #13).
  IF v_ext.filial_id IS NULL THEN
    v_tem_filial_compartilhada := true;
  ELSE
    v_filiais_distintas := ARRAY[v_ext.filial_id];
  END IF;

  PERFORM 1
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids)
   ORDER BY g.id
   FOR NO KEY UPDATE;

  SELECT count(*) INTO v_n
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids);
  IF v_n IS DISTINCT FROM array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: um ou mais recebíveis inexistentes';
  END IF;

  -- Outro grupo já apontando pra este extrato?
  IF EXISTS (
    SELECT 1
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.extrato_bancario_id = p_extrato_bancario_id
       AND NOT (g.id = ANY (v_ids))
  ) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato já vinculado a outros recebíveis Getnet';
  END IF;

  FOR v_rec IN
    SELECT g.*
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids)
     ORDER BY g.id
  LOOP
    IF v_rec.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: recebível % fora do tenant', v_rec.id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_rec.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do recebível %', v_rec.id;
    END IF;
    IF v_rec.extrato_bancario_id IS NOT NULL
       AND v_rec.extrato_bancario_id IS DISTINCT FROM p_extrato_bancario_id THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: recebível % já vinculado ao extrato %',
        v_rec.id, v_rec.extrato_bancario_id;
    END IF;
    IF v_rec.contrato_registradora IS NOT NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: recebível % pertence a lote de antecipação (contrato %); use fin_vincular_lote_antecipacao',
        v_rec.id, v_rec.contrato_registradora;
    END IF;
    IF v_rec.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_rec.filial_id = ANY (v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_rec.filial_id;
    END IF;

    v_liquido := v_liquido + COALESCE(
      v_rec.valor_liquido_parcela,
      v_rec.valor_liquido,
      COALESCE(v_rec.valor_parcela, v_rec.valor_venda) - abs(COALESCE(v_rec.descontos, 0)),
      0
    );
  END LOOP;

  IF coalesce(array_length(v_filiais_distintas, 1), 0) > 1
     AND NOT v_tem_filial_compartilhada THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato e recebíveis de filiais diferentes não podem ser vinculados juntos';
  END IF;

  v_delta := v_ext.valor - v_liquido;
  -- Discrepância sinalizada sem bloquear (plano Fase 3): tesoureiro escolheu.
  IF abs(v_delta) > 0.01 THEN
    v_warnings := v_warnings || format(
      'discrepância líquido Getnet (%s) vs extrato (%s): delta=%s',
      v_liquido, v_ext.valor, v_delta);
  END IF;

  UPDATE public.getnet_recebivel_lancamentos
     SET extrato_bancario_id = p_extrato_bancario_id
   WHERE id = ANY (v_ids);

  UPDATE public.extratos_bancarios
     SET reconciliado = true
   WHERE id = p_extrato_bancario_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_vincular_venda_banco_getnet', 'extratos_bancarios', p_extrato_bancario_id,
    jsonb_build_object(
      'recebivel_ids', to_jsonb(v_ids),
      'valor_liquido', v_liquido,
      'valor_extrato', v_ext.valor,
      'delta_valor', v_delta,
      'tipo_match', 'venda_banco_getnet'
    ),
    jsonb_build_object(
      'ok', true,
      'warnings', to_jsonb(v_warnings)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_extrato_bancario_id,
    'recebivel_ids', to_jsonb(v_ids),
    'valor_liquido', v_liquido,
    'valor_extrato', v_ext.valor,
    'delta_valor', v_delta,
    'warnings', to_jsonb(v_warnings)
  );
END;
$$;

COMMENT ON FUNCTION public.fin_vincular_venda_banco_getnet(uuid, uuid[], jsonb) IS
  'Fase 3 Conciliação Cartão Getnet (Hop 1): vincula recebíveis sem antecipação ao crédito bancário, grava extrato_bancario_id, marca reconciliado=true. Discrepância de valor vira warning (não bloqueia). has_filial_access no extrato e em cada recebível; filial mista só com âncora compartilhada (guardrail #13). Não chama fin_confirmar_conciliacao.';

GRANT EXECUTE ON FUNCTION public.fin_vincular_venda_banco_getnet(uuid, uuid[], jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_vincular_venda_banco_getnet(uuid, uuid[], jsonb)
  FROM anon;
