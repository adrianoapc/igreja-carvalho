-- Corrigir ambiguidade do identificador "score" em função com RETURNS TABLE
-- Em plpgsql, colunas de RETURNS TABLE viram variáveis; então precisamos qualificar o score do resultado.

CREATE OR REPLACE FUNCTION public.gerar_candidatos_conciliacao(
  p_igreja_id uuid,
  p_conta_id uuid DEFAULT NULL,
  p_mes_inicio date DEFAULT NULL,
  p_mes_fim date DEFAULT NULL,
  p_score_minimo numeric DEFAULT 0.6
)
RETURNS TABLE(
  extrato_id uuid,
  transacao_ids uuid[],
  tipo_match text,
  score numeric,
  features jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  p_mes_inicio := COALESCE(p_mes_inicio, date_trunc('month', CURRENT_DATE)::date);
  p_mes_fim := COALESCE(p_mes_fim, (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date);

  RETURN QUERY
  WITH candidatos_1x1 AS (
    SELECT 
      e.id AS extrato_id,
      ARRAY[t.id] AS transacao_ids,
      '1:1'::text AS tipo_match,
      (
        CASE 
          WHEN e.valor = t.valor THEN 0.4
          WHEN e.valor = 0 THEN 0.0
          ELSE 0.4 * (1.0 - (ABS(e.valor - t.valor) / GREATEST(ABS(e.valor), ABS(t.valor))))
        END +
        CASE 
          WHEN ABS(e.data_transacao - t.data_pagamento) = 0 THEN 0.3
          WHEN ABS(e.data_transacao - t.data_pagamento) <= 3 THEN 0.24
          WHEN ABS(e.data_transacao - t.data_pagamento) <= 7 THEN 0.15
          ELSE 0.06
        END +
        CASE 
          WHEN (e.tipo = 'credito' AND t.tipo = 'entrada') OR (e.tipo = 'debito' AND t.tipo = 'saida') THEN 0.1
          ELSE 0.0
        END +
        COALESCE((
          SELECT (COUNT(DISTINCT word)::float / GREATEST(
            (SELECT COUNT(*) FROM unnest(string_to_array(LOWER(REGEXP_REPLACE(e.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' '))),
            (SELECT COUNT(*) FROM unnest(string_to_array(LOWER(REGEXP_REPLACE(t.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' '))),
            1
          )) * 0.2
          FROM (
            SELECT unnest(string_to_array(LOWER(REGEXP_REPLACE(e.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' ')) AS word
            INTERSECT
            SELECT unnest(string_to_array(LOWER(REGEXP_REPLACE(t.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' ')) AS word
          ) AS overlap
        ), 0)
      )::numeric(5,4) AS score,
      jsonb_build_object(
        'extrato_valor', e.valor,
        'transacao_valor', t.valor,
        'diferenca_valor', ABS(e.valor - t.valor),
        'diferenca_dias', ABS(e.data_transacao - t.data_pagamento),
        'match_tipo', (e.tipo = 'credito' AND t.tipo = 'entrada') OR (e.tipo = 'debito' AND t.tipo = 'saida'),
        'categoria_id', t.categoria_id
      ) AS features
    FROM extratos_bancarios e
    INNER JOIN transacoes_financeiras t ON 
      e.igreja_id = t.igreja_id
      AND e.conta_id = t.conta_id
      AND (e.filial_id = t.filial_id OR e.filial_id IS NULL OR t.filial_id IS NULL)
    WHERE 
      e.igreja_id = p_igreja_id
      AND (p_conta_id IS NULL OR e.conta_id = p_conta_id)
      AND e.reconciliado = false
      AND e.transacao_vinculada_id IS NULL
      AND t.status = 'pago'
      AND e.data_transacao BETWEEN p_mes_inicio AND p_mes_fim
      AND t.data_pagamento BETWEEN p_mes_inicio - INTERVAL '30 days' AND p_mes_fim + INTERVAL '30 days'
      AND ABS(e.data_transacao - t.data_pagamento) <= 30
      AND NOT EXISTS (
        SELECT 1 FROM conciliacoes_lote cl WHERE cl.transacao_id = t.id
      )
  ),
  candidatos_1xN AS (
    SELECT 
      e.id AS extrato_id,
      array_agg(t.id ORDER BY t.data_pagamento) AS transacao_ids,
      '1:N'::text AS tipo_match,
      (
        CASE WHEN ABS(e.valor - SUM(t.valor)) < 0.01 THEN 0.8 ELSE 0.0 END +
        CASE 
          WHEN AVG(ABS(e.data_transacao - t.data_pagamento)) <= 3 THEN 0.2
          WHEN AVG(ABS(e.data_transacao - t.data_pagamento)) <= 7 THEN 0.1
          ELSE 0.05
        END
      )::numeric(5,4) AS score,
      jsonb_build_object(
        'extrato_valor', e.valor,
        'transacao_valor_total', SUM(t.valor),
        'qtd_transacoes', COUNT(t.id),
        'diferenca_dias_media', AVG(ABS(e.data_transacao - t.data_pagamento))::integer
      ) AS features
    FROM extratos_bancarios e
    INNER JOIN transacoes_financeiras t ON 
      e.igreja_id = t.igreja_id
      AND e.conta_id = t.conta_id
      AND (e.filial_id = t.filial_id OR e.filial_id IS NULL OR t.filial_id IS NULL)
    WHERE 
      e.igreja_id = p_igreja_id
      AND (p_conta_id IS NULL OR e.conta_id = p_conta_id)
      AND e.reconciliado = false
      AND e.transacao_vinculada_id IS NULL
      AND t.status = 'pago'
      AND e.data_transacao BETWEEN p_mes_inicio AND p_mes_fim
      AND t.data_pagamento BETWEEN e.data_transacao - INTERVAL '7 days' AND e.data_transacao + INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM conciliacoes_lote cl WHERE cl.transacao_id = t.id
      )
    GROUP BY e.id, e.valor, e.data_transacao
    HAVING 
      COUNT(t.id) BETWEEN 2 AND 10
      AND ABS(e.valor - SUM(t.valor)) < 0.01
  )
  SELECT r.extrato_id, r.transacao_ids, r.tipo_match, r.score, r.features
  FROM (
    SELECT * FROM candidatos_1x1
    UNION ALL
    SELECT * FROM candidatos_1xN
  ) AS r
  WHERE r.score >= p_score_minimo
  ORDER BY r.score DESC, r.tipo_match;
END;
$$;

COMMENT ON FUNCTION public.gerar_candidatos_conciliacao IS 
'Gera candidatos de conciliação com score baseado em similaridade de valor, data, tipo e descrição. Suporta matches 1:1 e 1:N.';