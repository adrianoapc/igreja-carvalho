-- ============================================================================
-- Card "Cartão" em Extratos/Histórico (Ciclo 2, C2-2)
--
-- `fin_stats_cartao_getnet` — agregação read-only sobre
-- `getnet_recebivel_lancamentos` pro card "Cartão" da tela de Histórico
-- (mockup original: "Vendas importadas / Vinculadas à oferta / Vinculadas
-- ao banco"). Mesma tabela e mesmos campos de vínculo
-- (`transacao_financeira_id`/`extrato_bancario_id`) que
-- `fin_listar_ledger_conciliacao_cartao` já usa pro ledger — não é uma
-- segunda fonte de verdade, só uma contagem direta, sem a lógica de
-- agrupamento por parcela/oferta que o ledger precisa e esta contagem não.
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
  -- vez por parcela (mesmo padrão documentado nas RPCs Hop 2, comentário
  -- "valor_venda 1x por NSU"). "Vendas importadas" precisa ser por NSU
  -- distinto; uma venda conta como vinculada se QUALQUER uma das suas
  -- parcelas já tem o vínculo (achado do code-review).
  RETURN QUERY
  SELECT
    COUNT(DISTINCT g.nsu)::integer AS vendas_importadas,
    COUNT(DISTINCT g.nsu) FILTER (WHERE g.transacao_financeira_id IS NOT NULL)::integer AS vinculadas_oferta,
    COUNT(DISTINCT g.nsu) FILTER (WHERE g.extrato_bancario_id IS NOT NULL)::integer AS vinculadas_banco
  FROM public.getnet_recebivel_lancamentos g
  WHERE g.igreja_id = v_igreja
    AND g.integracao_id = p_integracao_id
    AND g.data_vencimento IS NOT NULL
    AND g.data_vencimento BETWEEN p_periodo_inicio AND p_periodo_fim
    AND public.has_filial_access(v_igreja, g.filial_id)
    AND (v_scope IS NULL OR g.filial_id IS NULL OR g.filial_id = v_scope);
END;
$$;

COMMENT ON FUNCTION public.fin_stats_cartao_getnet(uuid, date, date, uuid, jsonb) IS
  'Agregação read-only sobre getnet_recebivel_lancamentos pro card "Cartão" de Extratos/Histórico (Ciclo 2, C2-2): total importado, vinculado à oferta, vinculado ao banco. Mesmos campos que o ledger unificado usa — não é fonte de verdade paralela.';

GRANT EXECUTE ON FUNCTION public.fin_stats_cartao_getnet(uuid, date, date, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_stats_cartao_getnet(uuid, date, date, uuid, jsonb) FROM anon;
