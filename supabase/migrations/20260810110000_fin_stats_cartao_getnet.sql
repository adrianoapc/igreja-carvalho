-- ============================================================================
-- Card "Cartão" em Extratos/Histórico (Ciclo 2, C2-2)
--
-- `fin_stats_cartao_getnet` — agregação read-only sobre
-- `getnet_recebivel_lancamentos` pro card "Cartão" da tela de Histórico
-- (mockup original: "Vendas importadas / Vinculadas à oferta / Vinculadas
-- ao banco"). Contadores alinhados à semântica do ledger unificado:
--   • oferta  = transacao_financeira_id (Hop 2)
--   • banco   = extrato_bancario_id (Hop 1) OU lote de antecipação
--               (contrato_registradora + getnet_antecipacao_lotes em
--               vinculado/lancamento_criado) — mesma regra de
--               fin_listar_ledger_conciliacao_cartao /
--               fin_conferencia_totais_getnet
-- Não é fonte de verdade paralela; só contagem direta, sem agrupamento
-- por oferta que o ledger precisa e esta tela não.
--
-- Identidade da venda = (data_venda, filial_id, nsu) — alinhado ao Hop 2
-- (fin_gerar_candidatos_oferta_venda_getnet). COUNT(DISTINCT nsu) sozinho
-- colapsa NSUs iguais em dias/filiais diferentes.
--
-- Contexto/filial seguem exatamente o padrão de
-- `fin_gerar_candidatos_venda_banco_getnet` (mesma integração Getnet,
-- mesmo `v_scope`/`has_filial_access`), sem exigir `p_conta_id` — a
-- contagem é agregada pra toda a integração no período, não por conta.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_stats_cartao_getnet(
  p_integracao_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_filial_id uuid DEFAULT NULL,
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  vendas_importadas integer,
  vinculadas_oferta integer,
  vinculadas_banco integer
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

  IF p_filial_id IS NOT NULL THEN
    IF NOT public.has_filial_access(v_igreja, p_filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial solicitada';
    END IF;
    v_scope := p_filial_id;
  ELSE
    v_scope := NULL;
  END IF;

  -- COUNT(*) simples contaria parcela, não venda — o CSV repete o NSU uma
  -- vez por parcela. Identidade = (data_venda, filial_id, nsu) como no
  -- Hop 2. Uma venda conta como vinculada se QUALQUER parcela já tem o
  -- vínculo. Banco = Hop 1 direto OU lote de antecipação (Bugbot #89).
  RETURN QUERY
  SELECT
    COUNT(DISTINCT (g.data_venda, g.filial_id, g.nsu))::integer AS vendas_importadas,
    COUNT(DISTINCT (g.data_venda, g.filial_id, g.nsu))
      FILTER (WHERE g.transacao_financeira_id IS NOT NULL)::integer AS vinculadas_oferta,
    COUNT(DISTINCT (g.data_venda, g.filial_id, g.nsu))
      FILTER (
        WHERE g.extrato_bancario_id IS NOT NULL
           OR (
             g.contrato_registradora IS NOT NULL
             AND EXISTS (
               SELECT 1
                 FROM public.getnet_antecipacao_lotes l
                WHERE l.igreja_id = v_igreja
                  AND l.integracao_id = p_integracao_id
                  AND l.contrato_registradora = g.contrato_registradora
                  AND l.status IN ('vinculado', 'lancamento_criado')
                  AND public.has_filial_access(v_igreja, l.filial_id)
             )
           )
      )::integer AS vinculadas_banco
  FROM public.getnet_recebivel_lancamentos g
  WHERE g.igreja_id = v_igreja
    AND g.integracao_id = p_integracao_id
    AND g.nsu IS NOT NULL
    AND g.nsu <> ''
    AND g.data_vencimento IS NOT NULL
    AND g.data_vencimento BETWEEN p_periodo_inicio AND p_periodo_fim
    AND public.has_filial_access(v_igreja, g.filial_id)
    AND (v_scope IS NULL OR g.filial_id IS NULL OR g.filial_id = v_scope);
END;
$$;

COMMENT ON FUNCTION public.fin_stats_cartao_getnet(uuid, date, date, uuid, jsonb) IS
  'Agregação read-only pro card Cartão de Extratos/Histórico (C2-2): vendas por (data_venda, filial_id, nsu); vinculadas_oferta via transacao_financeira_id; vinculadas_banco via extrato_bancario_id OU lote de antecipação (contrato_registradora).';

GRANT EXECUTE ON FUNCTION public.fin_stats_cartao_getnet(uuid, date, date, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_stats_cartao_getnet(uuid, date, date, uuid, jsonb) FROM anon;
