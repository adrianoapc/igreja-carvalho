-- ============================================================================
-- Conferência de totais por período (Fase B, item 4 do plano de importação
-- do Recebível Getnet) — ADR-029.
--
-- Não é match registro-a-registro (isso seriam os hops completos, fora de
-- escopo) — é um somatório simples que aponta diferença:
--   Σ Oferta bruto (entradas, forma de pagamento classificada como cartão)
--   − Σ taxa administrativa (MDR) das mesmas linhas
--   − Σ deságio de antecipação lançado no período (getnet_antecipacao_lotes
--     com status='lancamento_criado', cujo lançamento caiu na mesma
--     conta/período)
--   = esperado no banco
-- comparado contra Σ Banco creditado (extratos_bancarios, tipo='credito',
-- mesma conta/período). Se a diferença ≠ 0, o card mostra o valor
-- explicitamente — não decide sozinho o que significa (lote ainda não
-- vinculado, erro manual, etc.), só torna o gap visível.
--
-- Classificação "cartão": formas_pagamento.nome ILIKE '%cart%' — mais
-- direto/auditável pro tesoureiro do que um proxy por taxa_administrativa
-- (que pegaria boleto com taxa, se algum dia existir). Só funciona de forma
-- confiável agora que forma_pagamento_id é FK real (20260729130000) — antes
-- dessa migration não dava pra confiar no join.
--
-- Só leitura — sem fin_registrar_auditoria (não grava nada).
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
  v_oferta_bruto numeric;
  v_taxa_mdr numeric;
  v_desagio_lancado numeric;
  v_banco_creditado numeric;
  v_esperado numeric;
  v_diferenca numeric;
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: período inválido';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);

  SELECT COALESCE(SUM(t.valor), 0), COALESCE(SUM(t.taxas_administrativas), 0)
    INTO v_oferta_bruto, v_taxa_mdr
    FROM public.transacoes_financeiras t
    JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
   WHERE t.igreja_id = v_igreja
     AND t.conta_id = p_conta_id
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.data_vencimento BETWEEN p_data_inicio AND p_data_fim
     AND fp.nome ILIKE '%cart%';

  SELECT COALESCE(SUM(tf.valor), 0)
    INTO v_desagio_lancado
    FROM public.getnet_antecipacao_lotes lote
    JOIN public.transacoes_financeiras tf ON tf.id = lote.lancamento_desagio_id
   WHERE lote.igreja_id = v_igreja
     AND lote.status = 'lancamento_criado'
     AND tf.conta_id = p_conta_id
     AND tf.data_vencimento BETWEEN p_data_inicio AND p_data_fim;

  SELECT COALESCE(SUM(eb.valor), 0)
    INTO v_banco_creditado
    FROM public.extratos_bancarios eb
   WHERE eb.igreja_id = v_igreja
     AND eb.conta_id = p_conta_id
     AND eb.tipo = 'credito'
     AND eb.data_transacao BETWEEN p_data_inicio AND p_data_fim;

  v_esperado := v_oferta_bruto - v_taxa_mdr - v_desagio_lancado;
  v_diferenca := v_esperado - v_banco_creditado;

  RETURN jsonb_build_object(
    'ok', true,
    'oferta_bruto', v_oferta_bruto,
    'taxa_mdr', v_taxa_mdr,
    'desagio_lancado', v_desagio_lancado,
    'esperado_banco', v_esperado,
    'banco_creditado', v_banco_creditado,
    'diferenca_nao_explicada', v_diferenca
  );
END;
$$;

COMMENT ON FUNCTION public.fin_conferencia_totais_getnet(uuid, date, date, jsonb) IS
  'Conferência de totais por conta/período: Oferta bruto (cartão) - MDR - deságio lançado vs. Banco creditado. Só leitura, sinaliza diferença sem decidir a causa. Fase B do Recebível Getnet.';

GRANT EXECUTE ON FUNCTION public.fin_conferencia_totais_getnet(uuid, date, date, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_conferencia_totais_getnet(uuid, date, date, jsonb) FROM anon;
