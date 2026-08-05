-- ============================================================================
-- Fase 1 — Conciliação Cartão Getnet: Hop 2 (Oferta ↔ Venda), só leitura.
--
-- 1) Coluna de vínculo futuro (Fase 2 grava; esta fase só filtra IS NULL):
--    getnet_recebivel_lancamentos.transacao_financeira_id
-- 2) Índice (integracao_id, data_venda) pro agrupamento por dia.
-- 3) RPC fin_gerar_candidatos_oferta_venda_getnet — NÃO reaproveita
--    fin_gerar_candidatos_conciliacao (hardcoded pra extrato×transação).
--
-- Regras fechadas com CSV real do portal (ago/2025 + set–nov/2025):
--   - valor_venda REPETE o bruto em cada parcela do mesmo NSU
--     ("1 de 7" e "2 de 7" ambos com 1.441,66) → por NSU usar UMA vez
--     (MAX/DISTINCT), nunca somar valor_venda das linhas.
--   - bandeira_modalidade é texto ("Mastercard Crédito", "Visa Débito",
--     "Elo Débito") → direção via ILIKE '%cr_dito%' / '%d_bito%'.
--   - Agrupa por data_venda + direção; casa contra oferta (entrada cartão,
--     nao_conciliado) com data_vencimento ≈ data_venda e valor ≈ bruto.
-- ============================================================================

-- ─── 1. Coluna de vínculo Hop 2 (ainda sem writer nesta fase) ───────────────
ALTER TABLE public.getnet_recebivel_lancamentos
  ADD COLUMN IF NOT EXISTS transacao_financeira_id uuid
    REFERENCES public.transacoes_financeiras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_getnet_recebivel_lanc_transacao
  ON public.getnet_recebivel_lancamentos(transacao_financeira_id)
  WHERE transacao_financeira_id IS NOT NULL;

COMMENT ON COLUMN public.getnet_recebivel_lancamentos.transacao_financeira_id IS
  'Hop 2 (Oferta ↔ Venda): vínculo com transacoes_financeiras. Gravado por fin_vincular_venda_getnet_oferta (Fase 2); NULL = ainda não conciliado.';

-- ─── 2. Índice por integração + data da venda ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_getnet_recebivel_lanc_int_venda
  ON public.getnet_recebivel_lancamentos(integracao_id, data_venda);

-- ─── 3. RPC de candidatos (read-only) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(
  p_integracao_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_contexto jsonb DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL
)
RETURNS TABLE(
  data_venda date,
  direcao text,
  filial_id uuid,
  valor_bruto numeric,
  recebivel_ids uuid[],
  nsus text[],
  transacao_id uuid,
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
  v_scope uuid;
BEGIN
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

  -- Escopo opcional de filial (UI "Todas" = NULL). Valida contra has_filial_access
  -- (não eq puro no JWT — admin_igreja / user_filial_access / registro global).
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
  -- Linhas de venda elegíveis (ainda sem vínculo Hop 2).
  vendas AS (
    SELECT
      g.id,
      g.filial_id,
      g.data_venda,
      g.nsu,
      g.valor_venda,
      g.bandeira_modalidade,
      g.lancamento,
      CASE
        WHEN COALESCE(g.bandeira_modalidade, '') ~* 'cr[eé]dito'
          OR COALESCE(g.lancamento, '') ~* 'cr[eé]dito'
          THEN 'credito'
        WHEN COALESCE(g.bandeira_modalidade, '') ~* 'd[eé]bito'
          OR COALESCE(g.lancamento, '') ~* 'd[eé]bito'
          THEN 'debito'
        ELSE NULL
      END AS direcao
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.integracao_id = p_integracao_id
     AND g.igreja_id = v_igreja
     AND g.transacao_financeira_id IS NULL
     AND g.data_venda IS NOT NULL
     AND g.data_venda BETWEEN p_periodo_inicio AND p_periodo_fim
     AND g.nsu IS NOT NULL
     AND g.nsu <> ''
     AND g.valor_venda IS NOT NULL
     AND public.has_filial_access(v_igreja, g.filial_id)
     AND (
       v_scope IS NULL
       OR g.filial_id IS NULL
       OR g.filial_id = v_scope
     )
  ),
  -- Por NSU: valor_venda uma vez (CSV real repete o bruto em cada parcela).
  -- filial_id entra na chave: não misturar vendas de filiais diferentes no
  -- mesmo grupo (integração global / "Todas as filiais").
  por_nsu AS (
    SELECT
      v.data_venda,
      v.direcao,
      v.filial_id,
      v.nsu,
      MAX(v.valor_venda) AS valor_venda
    FROM vendas v
   WHERE v.direcao IS NOT NULL
   GROUP BY v.data_venda, v.direcao, v.filial_id, v.nsu
  ),
  -- Agrupa o dia + direção + filial (oferta do culto costuma ser 1 lançamento
  -- por direção naquela filial).
  grupos AS (
    SELECT
      v.data_venda,
      v.direcao,
      v.filial_id,
      (SELECT SUM(p.valor_venda)
         FROM por_nsu p
        WHERE p.data_venda = v.data_venda
          AND p.direcao = v.direcao
          AND p.filial_id IS NOT DISTINCT FROM v.filial_id) AS valor_bruto,
      array_agg(v.id ORDER BY v.id) AS recebivel_ids,
      array_agg(DISTINCT v.nsu ORDER BY v.nsu) AS nsus
    FROM vendas v
   WHERE v.direcao IS NOT NULL
   GROUP BY v.data_venda, v.direcao, v.filial_id
  ),
  -- Ofertas candidatas (entrada cartão, não conciliadas).
  ofertas AS (
    SELECT
      t.id,
      t.filial_id,
      t.data_vencimento,
      t.valor,
      CASE
        WHEN COALESCE(fp.nome, t.forma_pagamento, '') ~* 'cr[eé]dito' THEN 'credito'
        WHEN COALESCE(fp.nome, t.forma_pagamento, '') ~* 'd[eé]bito' THEN 'debito'
        ELSE NULL
      END AS direcao_forma
    FROM public.transacoes_financeiras t
    LEFT JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
   WHERE t.igreja_id = v_igreja
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.conciliacao_status = 'nao_conciliado'
     AND COALESCE(fp.nome, t.forma_pagamento, '') ILIKE '%cart%'
     AND t.data_vencimento BETWEEN (p_periodo_inicio - 1) AND (p_periodo_fim + 1)
     AND public.has_filial_access(v_igreja, t.filial_id)
     AND (
       v_scope IS NULL
       OR t.filial_id IS NULL
       OR t.filial_id = v_scope
     )
  ),
  matches AS (
    SELECT
      g.data_venda,
      g.direcao,
      g.filial_id,
      g.valor_bruto,
      g.recebivel_ids,
      g.nsus,
      o.id AS transacao_id,
      CASE
        WHEN o.data_vencimento = g.data_venda
         AND abs(o.valor - g.valor_bruto) <= 0.01 THEN 1.0::numeric
        WHEN abs(o.data_vencimento - g.data_venda) = 1
         AND abs(o.valor - g.valor_bruto) <= 0.01 THEN 0.85::numeric
        ELSE NULL
      END AS score,
      jsonb_build_object(
        'valor_oferta', o.valor,
        'data_vencimento', o.data_vencimento,
        'delta_dias', (o.data_vencimento - g.data_venda),
        'delta_valor', (o.valor - g.valor_bruto),
        'direcao_forma', o.direcao_forma,
        'filial_oferta', o.filial_id,
        'n_recebiveis', coalesce(array_length(g.recebivel_ids, 1), 0),
        'n_nsus', coalesce(array_length(g.nsus, 1), 0)
      ) AS features
    FROM grupos g
    JOIN ofertas o
      ON abs(o.valor - g.valor_bruto) <= 0.01
     AND abs(o.data_vencimento - g.data_venda) <= 1
     -- Não mistura crédito/débito: se a forma declara direção, tem que bater.
     AND (o.direcao_forma IS NULL OR o.direcao_forma = g.direcao)
     -- Filial: oferta global casa com qualquer grupo; senão tem que bater.
     AND (o.filial_id IS NULL OR g.filial_id IS NULL OR o.filial_id = g.filial_id)
  )
  SELECT
    m.data_venda,
    m.direcao,
    m.filial_id,
    m.valor_bruto,
    m.recebivel_ids,
    m.nsus,
    m.transacao_id,
    m.score,
    m.features
  FROM matches m
  WHERE m.score IS NOT NULL
  ORDER BY m.score DESC, m.data_venda, m.direcao, m.transacao_id;
END;
$$;

COMMENT ON FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(uuid, date, date, jsonb, uuid) IS
  'Fase 1 Conciliação Cartão Getnet (Hop 2, só leitura): agrupa getnet_recebivel_lancamentos por data_venda+direção (valor_venda 1× por NSU — CSV repete bruto nas parcelas), casa contra ofertas cartão nao_conciliadas. has_filial_access na integração, em cada recebível e em cada oferta.';

GRANT EXECUTE ON FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(uuid, date, date, jsonb, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(uuid, date, date, jsonb, uuid)
  FROM anon;
