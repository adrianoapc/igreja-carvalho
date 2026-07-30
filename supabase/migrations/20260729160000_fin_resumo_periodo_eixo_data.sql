-- fin_resumo_periodo sempre filtrava por data_vencimento (incluindo
-- pendentes) — usado no comparativo "mês anterior" do Dashboard, que agora
-- pode buscar o período atual em modo "Data de Caixa" (data_pagamento,
-- só pago). Sem esse ajuste o comparativo mistura eixos: período atual em
-- caixa x mês anterior sempre em vencimento, tornando o percentual e o
-- gráfico de comparação incoerentes com o filtro escolhido.
--
-- p_eixo='vencimento' (default): mantém o comportamento atual.
-- p_eixo='pagamento': filtra por data_pagamento e só status='pago' — mesma
-- semântica de "Regime de Caixa" do get_dre_anual (pendente não tem
-- data_pagamento, não faria sentido incluir).

DROP FUNCTION IF EXISTS public.fin_resumo_periodo(date, date, uuid);

CREATE OR REPLACE FUNCTION public.fin_resumo_periodo(
  p_inicio date,
  p_fim date,
  p_filial_id uuid DEFAULT NULL,
  p_eixo text DEFAULT 'vencimento'
)
RETURNS TABLE(tipo text, status text, total numeric, quantidade bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_igreja uuid := public.fin_exigir_leitura_financeira(p_filial_id);
BEGIN
  IF p_eixo NOT IN ('vencimento', 'pagamento') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: eixo deve ser vencimento|pagamento';
  END IF;

  RETURN QUERY
  SELECT t.tipo, t.status,
         COALESCE(SUM(t.valor), 0) AS total,
         COUNT(*) AS quantidade
    FROM public.transacoes_financeiras t
    LEFT JOIN public.solicitacoes_reembolso sr ON sr.id = t.solicitacao_reembolso_id
   WHERE t.igreja_id = v_igreja
     AND (p_filial_id IS NULL OR t.filial_id = p_filial_id)
     AND (t.solicitacao_reembolso_id IS NULL OR sr.status = 'pago')
     AND (
       (p_eixo = 'vencimento'
          AND t.data_vencimento BETWEEN p_inicio AND p_fim
          AND t.status <> 'cancelado')
       OR
       (p_eixo = 'pagamento'
          AND t.data_pagamento BETWEEN p_inicio AND p_fim
          AND t.status = 'pago')
     )
   GROUP BY t.tipo, t.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_resumo_periodo(date, date, uuid, text) TO authenticated;
