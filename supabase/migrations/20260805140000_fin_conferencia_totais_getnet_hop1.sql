-- ============================================================================
-- Fase 4 — Conciliação Cartão Getnet: corrige fin_conferencia_totais_getnet.
--
-- Antes: v_banco_creditado = Σ TODO crédito da conta no período (Pix,
-- depósito, etc.) → "diferença não explicada" falsa (ex. -R$23k).
--
-- Agora: soma só créditos com vínculo Getnet real —
--   • Hop 1: getnet_recebivel_lancamentos.extrato_bancario_id
--   • lote de antecipação: getnet_antecipacao_lotes.extrato_bancario_id
-- Nunca filtra por extratos_bancarios.origem (EDI tipo 5 pode espelhar/
-- duplicar a linha do banco).
--
-- Também devolve liquido_vinculado (Σ líquido das linhas Hop 1 no período)
-- pra transparência; a diferença da UI continua esperado − banco_creditado.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_conferencia_totais_getnet(
  p_conta_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_conta_filial uuid;
  v_oferta_bruto numeric;
  v_taxa_mdr numeric;
  v_desagio_lancado numeric;
  v_banco_creditado numeric;
  v_liquido_vinculado numeric;
  v_esperado numeric;
  v_diferenca numeric;
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: período inválido';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);

  SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial desta conta';
  END IF;

  -- Lado Oferta (inalterado): bruto cartão − MDR − deságio lançado.
  SELECT COALESCE(SUM(t.valor), 0), COALESCE(SUM(t.taxas_administrativas), 0)
    INTO v_oferta_bruto, v_taxa_mdr
    FROM public.transacoes_financeiras t
    LEFT JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
   WHERE t.igreja_id = v_igreja
     AND t.conta_id = p_conta_id
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.data_vencimento BETWEEN p_data_inicio AND p_data_fim
     AND COALESCE(fp.nome, t.forma_pagamento) ILIKE '%cart%';

  SELECT COALESCE(SUM(tf.valor), 0)
    INTO v_desagio_lancado
    FROM public.getnet_antecipacao_lotes lote
    JOIN public.transacoes_financeiras tf ON tf.id = lote.lancamento_desagio_id
   WHERE lote.igreja_id = v_igreja
     AND lote.status = 'lancamento_criado'
     AND tf.conta_id = p_conta_id
     AND tf.data_vencimento BETWEEN p_data_inicio AND p_data_fim;

  -- Banco Getnet: join real (Hop 1 e/ou lote). DISTINCT por extrato —
  -- N recebíveis podem apontar pro mesmo crédito.
  SELECT COALESCE(SUM(eb.valor), 0)
    INTO v_banco_creditado
    FROM public.extratos_bancarios eb
   WHERE eb.igreja_id = v_igreja
     AND eb.conta_id = p_conta_id
     AND eb.tipo = 'credito'
     AND eb.data_transacao BETWEEN p_data_inicio AND p_data_fim
     AND (
       EXISTS (
         SELECT 1
           FROM public.getnet_recebivel_lancamentos g
          WHERE g.extrato_bancario_id = eb.id
            AND g.igreja_id = v_igreja
       )
       OR EXISTS (
         SELECT 1
           FROM public.getnet_antecipacao_lotes l
          WHERE l.extrato_bancario_id = eb.id
            AND l.igreja_id = v_igreja
       )
     );

  -- Σ líquido Hop 1 vinculado no período (por data_vencimento do recebível,
  -- não pela data_vencimento da oferta — causa raiz do -R$23k).
  SELECT COALESCE(SUM(
           COALESCE(
             g.valor_liquido_parcela,
             g.valor_liquido,
             COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
           )
         ), 0)
    INTO v_liquido_vinculado
    FROM public.getnet_recebivel_lancamentos g
    JOIN public.extratos_bancarios eb ON eb.id = g.extrato_bancario_id
   WHERE g.igreja_id = v_igreja
     AND eb.conta_id = p_conta_id
     AND g.data_vencimento BETWEEN p_data_inicio AND p_data_fim;

  v_esperado := v_oferta_bruto - v_taxa_mdr - v_desagio_lancado;
  v_diferenca := v_esperado - v_banco_creditado;

  RETURN jsonb_build_object(
    'ok', true,
    'oferta_bruto', v_oferta_bruto,
    'taxa_mdr', v_taxa_mdr,
    'desagio_lancado', v_desagio_lancado,
    'esperado_banco', v_esperado,
    'banco_creditado', v_banco_creditado,
    'liquido_vinculado', v_liquido_vinculado,
    'diferenca_nao_explicada', v_diferenca
  );
END;
$$;

COMMENT ON FUNCTION public.fin_conferencia_totais_getnet(uuid, date, date, jsonb) IS
  'Fase 4 Conciliação Cartão Getnet: Oferta bruto − MDR − deságio = esperado; banco_creditado = Σ créditos com vínculo Hop 1 (getnet_recebivel_lancamentos.extrato_bancario_id) ou lote de antecipação — nunca todo crédito da conta nem filtro por origem. has_filial_access na conta.';
