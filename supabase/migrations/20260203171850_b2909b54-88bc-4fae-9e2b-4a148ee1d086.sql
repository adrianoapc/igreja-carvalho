-- Corrigir função reconciliar_transacoes: t.data -> t.data_pagamento
CREATE OR REPLACE FUNCTION public.reconciliar_transacoes(
  p_conta_id UUID,
  p_tolerancia_valor NUMERIC DEFAULT 0.50,
  p_tolerancia_dias INTEGER DEFAULT 3
)
RETURNS TABLE(
  extrato_id UUID,
  transacao_id UUID,
  score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Retorna pares de extrato/transação que podem ser conciliados
  -- Score: 100 = match perfeito, menor = menos confiável
  RETURN QUERY
  WITH matches AS (
    SELECT 
      e.id AS eid,
      t.id AS tid,
      CASE 
        -- Match exato de valor e data = 100 pontos
        WHEN e.valor = t.valor AND e.data_transacao::date = t.data_pagamento::date THEN 100
        -- Match de valor com tolerância de data = 80 pontos
        WHEN e.valor = t.valor AND ABS(e.data_transacao::date - t.data_pagamento::date) <= p_tolerancia_dias THEN 80
        -- Match de data com tolerância de valor = 70 pontos
        WHEN e.data_transacao::date = t.data_pagamento::date AND ABS(e.valor - t.valor) <= p_tolerancia_valor THEN 70
        -- Match com ambas tolerâncias = 50 pontos
        WHEN ABS(e.data_transacao::date - t.data_pagamento::date) <= p_tolerancia_dias 
             AND ABS(e.valor - t.valor) <= p_tolerancia_valor THEN 50
        ELSE 0
      END AS match_score
    FROM extratos_bancarios e
    INNER JOIN transacoes_financeiras t ON t.conta_id = e.conta_id
    WHERE e.conta_id = p_conta_id
      AND e.reconciliado = FALSE
      AND e.transacao_vinculada_id IS NULL
      AND t.status = 'pago'
      -- Mesmo tipo (crédito/débito)
      AND (
        (e.tipo = 'credito' AND t.tipo = 'entrada')
        OR (e.tipo = 'debito' AND t.tipo = 'saida')
      )
  )
  SELECT 
    m.eid AS extrato_id,
    m.tid AS transacao_id,
    m.match_score AS score
  FROM matches m
  WHERE m.match_score >= 50
  ORDER BY m.match_score DESC;
END;
$$;