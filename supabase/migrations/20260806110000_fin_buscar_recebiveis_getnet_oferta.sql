-- ============================================================================
-- Fase 7a — Conciliação Cartão Getnet: busca manual de recebível pra uma
-- oferta específica (só leitura).
--
-- Fecha o gap do botão "Buscar manualmente" da linha "Pendente vínculo" do
-- ledger (fin_listar_ledger_conciliacao_cartao) — hoje só existe busca
-- textual (p_busca) pro fluxo de lote de antecipação
-- (fin_gerar_candidatos_lote_antecipacao_getnet). Espelha o mesmo padrão
-- p_busca/p_limite/teto sem dump de histórico. Confirmação continua manual
-- via fin_vincular_venda_getnet_oferta (já existente, inalterado).
--
-- p_integracao_id: obrigatório — mesma regra do ledger / Hop 2 candidatos
-- (igreja com 2 CNPJs Getnet não mistura NSUs de outro EC).
--
-- Score 0..100, mesma escala/corte 60/30 da família lote de antecipação
-- (Fase 7b reaproveita o ScoreBadge unificado). Componente "categórico" (40
-- pts) não pode ser literalmente o texto 'antecipa'/'getnet' do lote (não
-- faz sentido aqui) — substituído pela direção crédito/débito bater entre
-- bandeira_modalidade/lancamento do recebível e a forma de pagamento da
-- oferta, mesmo sinal categórico que fin_gerar_candidatos_oferta_venda_
-- getnet já usa pra não misturar grupo de direção oposta. Date/valor mantêm
-- os mesmos pesos/janelas (30/20/10 e 30/15).
--
-- Direção da oferta: COALESCE(fp.nome, t.forma_pagamento) via LEFT JOIN —
-- ofertas só com rótulo texto (forma_pagamento_id NULL) ainda pontuam
-- (review #83).
-- ============================================================================

-- Drop da assinatura do 1º commit da PR (sem p_integracao_id), se existir —
-- CREATE OR REPLACE com args diferentes cria overload, não substitui.
DROP FUNCTION IF EXISTS public.fin_buscar_recebiveis_getnet_oferta(uuid, jsonb, text, integer);

CREATE OR REPLACE FUNCTION public.fin_buscar_recebiveis_getnet_oferta(
  p_transacao_id uuid,
  p_integracao_id uuid,
  p_contexto jsonb DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_limite integer DEFAULT 100
)
RETURNS TABLE(
  recebivel_id uuid,
  nsu text,
  data_venda date,
  valor_venda numeric,
  bandeira_modalidade text,
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
  v_trx public.transacoes_financeiras%ROWTYPE;
  v_integracao record;
  v_direcao_oferta text;
  v_limite int;
  v_busca text;
BEGIN
  IF p_transacao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_transacao_id é obrigatório';
  END IF;
  IF p_integracao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_integracao_id é obrigatório';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_busca := NULLIF(btrim(COALESCE(p_busca, '')), '');

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

  SELECT t.* INTO v_trx
    FROM public.transacoes_financeiras t
   WHERE t.id = p_transacao_id;

  IF v_trx.id IS NULL OR v_trx.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_transacao_id;
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_trx.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do lançamento';
  END IF;
  IF v_trx.tipo IS DISTINCT FROM 'entrada' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: busca de recebível só se aplica a ofertas (tipo=entrada)';
  END IF;
  IF v_trx.conciliacao_status IS DISTINCT FROM 'nao_conciliado' THEN
    RAISE EXCEPTION 'FIN_JA_LANCADO: lançamento já conciliado (%); não há recebíveis para buscar', v_trx.conciliacao_status;
  END IF;

  -- LEFT JOIN + COALESCE: forma_pagamento_id NULL ainda usa o texto legado
  -- (mesmo padrão de fin_gerar_candidatos_oferta_venda_getnet).
  SELECT CASE
           WHEN COALESCE(fp.nome, v_trx.forma_pagamento, '') ~* 'cr[eé]dito' THEN 'credito'
           WHEN COALESCE(fp.nome, v_trx.forma_pagamento, '') ~* 'd[eé]bito' THEN 'debito'
           ELSE NULL
         END
    INTO v_direcao_oferta
    FROM (SELECT 1) AS _
    LEFT JOIN public.formas_pagamento fp ON fp.id = v_trx.forma_pagamento_id;

  -- Sempre há âncora (data_vencimento/valor da oferta) — teto moderado,
  -- mesmo default/corte da busca textual do lote de antecipação.
  v_limite := GREATEST(1, LEAST(COALESCE(NULLIF(p_limite, 0), 100), 500));

  RETURN QUERY
  WITH
  base AS (
    SELECT
      g.id,
      g.nsu,
      g.data_venda,
      g.valor_venda,
      g.bandeira_modalidade,
      g.lancamento,
      g.filial_id,
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
   WHERE g.igreja_id = v_igreja
     AND g.integracao_id = p_integracao_id
     AND g.transacao_financeira_id IS NULL
     AND g.nsu IS NOT NULL
     AND g.nsu <> ''
     AND g.valor_venda IS NOT NULL
     AND public.has_filial_access(v_igreja, g.filial_id)
     -- Espelha o guardrail #13 (filial mista) do writer: oferta com filial
     -- concreta só pode confirmar com recebível global ou da mesma filial.
     AND (
       v_trx.filial_id IS NULL
       OR g.filial_id IS NULL
       OR g.filial_id = v_trx.filial_id
     )
     AND (
       v_busca IS NULL
       OR g.nsu ILIKE '%' || v_busca || '%'
       OR g.lancamento ILIKE '%' || v_busca || '%'
       OR g.bandeira_modalidade ILIKE '%' || v_busca || '%'
     )
  ),
  pontuados AS (
    SELECT
      b.id,
      b.nsu,
      b.data_venda,
      b.valor_venda,
      b.bandeira_modalidade,
      b.filial_id,
      b.direcao,
      (
        CASE
          WHEN v_direcao_oferta IS NOT NULL AND b.direcao IS NOT NULL AND b.direcao = v_direcao_oferta THEN 40
          ELSE 0
        END
        + CASE
            WHEN v_trx.data_vencimento IS NULL OR b.data_venda IS NULL THEN 0
            WHEN b.data_venda = v_trx.data_vencimento THEN 30
            WHEN abs(b.data_venda - v_trx.data_vencimento) <= 3 THEN 20
            WHEN abs(b.data_venda - v_trx.data_vencimento) <= 10 THEN 10
            ELSE 0
          END
        + CASE
            WHEN v_trx.valor IS NULL THEN 0
            WHEN abs(b.valor_venda - v_trx.valor) <= 1 THEN 30
            WHEN v_trx.valor <> 0 AND abs(b.valor_venda - v_trx.valor) / abs(v_trx.valor) <= 0.2 THEN 15
            ELSE 0
          END
      )::numeric AS score
    FROM base b
  )
  SELECT
    p.id AS recebivel_id,
    p.nsu,
    p.data_venda,
    p.valor_venda,
    p.bandeira_modalidade,
    p.score,
    jsonb_build_object(
      'filial_recebivel', p.filial_id,
      'direcao_oferta', v_direcao_oferta,
      'direcao_recebivel', p.direcao,
      'valor_oferta', v_trx.valor,
      'data_vencimento_oferta', v_trx.data_vencimento,
      'delta_dias', CASE WHEN v_trx.data_vencimento IS NULL OR p.data_venda IS NULL THEN NULL
                          ELSE (p.data_venda - v_trx.data_vencimento) END,
      'delta_valor', CASE WHEN v_trx.valor IS NULL THEN NULL ELSE (p.valor_venda - v_trx.valor) END
    ) AS features
  FROM pontuados p
  -- Sem busca: só quem pontuou de verdade (evita dump do histórico inteiro).
  WHERE v_busca IS NOT NULL OR p.score >= 15
  ORDER BY p.score DESC, p.data_venda DESC, p.id
  LIMIT v_limite;
END;
$$;

COMMENT ON FUNCTION public.fin_buscar_recebiveis_getnet_oferta(uuid, uuid, jsonb, text, integer) IS
  'Fase 7a Conciliação Cartão Getnet (só leitura): busca manual de getnet_recebivel_lancamentos ainda livres (transacao_financeira_id IS NULL) pra vincular a uma oferta específica, escopada por p_integracao_id. Espelha fin_gerar_candidatos_lote_antecipacao_getnet (p_busca/p_limite, teto sem dump). Score 0..100: 40 direção crédito/débito bate + 30/20/10 proximidade de data + 30/15 proximidade de valor. Direção da oferta via LEFT JOIN formas_pagamento + COALESCE com texto legado. Filial mista segue o guardrail #13. Confirmação continua via fin_vincular_venda_getnet_oferta.';

GRANT EXECUTE ON FUNCTION public.fin_buscar_recebiveis_getnet_oferta(uuid, uuid, jsonb, text, integer)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_buscar_recebiveis_getnet_oferta(uuid, uuid, jsonb, text, integer)
  FROM anon;
