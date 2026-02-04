-- Função para gerar candidatos de conciliação inteligente
CREATE OR REPLACE FUNCTION public.gerar_candidatos_conciliacao(
  p_igreja_id UUID,
  p_conta_id UUID DEFAULT NULL,
  p_mes_inicio DATE DEFAULT CURRENT_DATE - INTERVAL '3 months',
  p_mes_fim DATE DEFAULT CURRENT_DATE,
  p_score_minimo NUMERIC DEFAULT 0.5
)
RETURNS TABLE (
  extrato_id UUID,
  transacao_ids UUID[],
  tipo_match TEXT,
  score NUMERIC,
  features JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Candidatos 1:1 (um extrato para uma transação)
  WITH candidatos_1x1 AS (
    SELECT 
      e.id AS extrato_id,
      ARRAY[t.id] AS transacao_ids,
      '1:1'::text AS tipo_match,
      (
        -- Valor (40%)
        CASE 
          WHEN e.valor = t.valor THEN 0.4
          WHEN e.valor = 0 THEN 0.0
          ELSE 0.4 * (1.0 - (ABS(e.valor - t.valor) / GREATEST(ABS(e.valor), ABS(t.valor))))
        END +
        -- Data (30%)
        CASE 
          WHEN ABS(EXTRACT(EPOCH FROM (e.data_transacao - t.data_pagamento)) / 86400) = 0 THEN 0.3
          WHEN ABS(EXTRACT(EPOCH FROM (e.data_transacao - t.data_pagamento)) / 86400) <= 3 THEN 0.24
          WHEN ABS(EXTRACT(EPOCH FROM (e.data_transacao - t.data_pagamento)) / 86400) <= 7 THEN 0.15
          ELSE 0.06
        END +
        -- Tipo (10%)
        CASE 
          WHEN (e.tipo = 'credito' AND t.tipo = 'entrada') OR (e.tipo = 'debito' AND t.tipo = 'saida') THEN 0.1
          ELSE 0.0
        END +
        -- Descrição overlap (20%)
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
        'diferenca_dias', ABS(EXTRACT(EPOCH FROM (e.data_transacao - t.data_pagamento)) / 86400)::integer,
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
      AND ABS(EXTRACT(EPOCH FROM (e.data_transacao - t.data_pagamento)) / 86400) <= 30
      AND NOT EXISTS (
        SELECT 1 FROM conciliacoes_lote cl WHERE cl.transacao_id = t.id
      )
  ),
  -- Candidatos 1:N (um extrato para múltiplas transações que somam o valor)
  candidatos_1xN AS (
    SELECT 
      e.id AS extrato_id,
      array_agg(t.id ORDER BY t.data_pagamento) AS transacao_ids,
      '1:N'::text AS tipo_match,
      (
        -- Valor exato (80%)
        CASE WHEN ABS(e.valor - SUM(t.valor)) < 0.01 THEN 0.8 ELSE 0.0 END +
        -- Data média (20%)
        CASE 
          WHEN AVG(ABS(EXTRACT(EPOCH FROM (e.data_transacao - t.data_pagamento)) / 86400)) <= 3 THEN 0.2
          WHEN AVG(ABS(EXTRACT(EPOCH FROM (e.data_transacao - t.data_pagamento)) / 86400)) <= 7 THEN 0.1
          ELSE 0.05
        END
      )::numeric(5,4) AS score,
      jsonb_build_object(
        'extrato_valor', e.valor,
        'transacao_valor_total', SUM(t.valor),
        'qtd_transacoes', COUNT(t.id),
        'diferenca_dias_media', AVG(ABS(EXTRACT(EPOCH FROM (e.data_transacao - t.data_pagamento)) / 86400))::integer
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
  -- Union e filtro por score mínimo
  SELECT * FROM candidatos_1x1 WHERE score >= p_score_minimo
  UNION ALL
  SELECT * FROM candidatos_1xN WHERE score >= p_score_minimo
  ORDER BY score DESC, tipo_match;
END;
$$;

COMMENT ON FUNCTION public.gerar_candidatos_conciliacao IS 
'Gera sugestões de conciliação 1:1 e 1:N com score heurístico. Parâmetros: igreja_id (obrigatório), conta_id (opcional), período, score_minimo.';

-- Função para aplicar sugestão aceita
CREATE OR REPLACE FUNCTION public.aplicar_sugestao_conciliacao(
  p_sugestao_id UUID,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sugestao RECORD;
  v_extrato_id UUID;
  v_transacao_id UUID;
BEGIN
  -- Buscar sugestão
  SELECT * INTO v_sugestao
  FROM conciliacao_ml_sugestoes
  WHERE id = p_sugestao_id AND status = 'pendente';

  IF v_sugestao IS NULL THEN
    RAISE EXCEPTION 'Sugestão não encontrada ou já processada';
  END IF;

  -- Aplicar conciliação baseado no tipo
  IF v_sugestao.tipo_match = '1:1' THEN
    -- Conciliação 1:1
    v_extrato_id := v_sugestao.extrato_ids[1];
    v_transacao_id := v_sugestao.transacao_ids[1];

    UPDATE extratos_bancarios
    SET reconciliado = true, transacao_vinculada_id = v_transacao_id
    WHERE id = v_extrato_id;

    -- Inserir audit log
    INSERT INTO reconciliacao_audit_logs (
      extrato_id, transacao_id, igreja_id, filial_id, conta_id,
      tipo_reconciliacao, score, usuario_id
    ) VALUES (
      v_extrato_id, v_transacao_id, v_sugestao.igreja_id, v_sugestao.filial_id, v_sugestao.conta_id,
      'automatica', v_sugestao.score::integer, p_usuario_id
    );

  ELSIF v_sugestao.tipo_match = '1:N' THEN
    -- Conciliação 1:N
    v_extrato_id := v_sugestao.extrato_ids[1];

    UPDATE extratos_bancarios
    SET reconciliado = true
    WHERE id = v_extrato_id;

    -- Inserir lotes
    INSERT INTO conciliacoes_lote (extrato_id, transacao_id, igreja_id)
    SELECT v_extrato_id, unnest(v_sugestao.transacao_ids), v_sugestao.igreja_id;
  END IF;

  -- Atualizar status da sugestão
  UPDATE conciliacao_ml_sugestoes
  SET status = 'aceita', updated_at = now()
  WHERE id = p_sugestao_id;

  -- Inserir feedback
  INSERT INTO conciliacao_ml_feedback (
    sugestao_id, igreja_id, filial_id, conta_id, tipo_match,
    extrato_ids, transacao_ids, acao, score, modelo_versao, usuario_id
  ) VALUES (
    p_sugestao_id, v_sugestao.igreja_id, v_sugestao.filial_id, v_sugestao.conta_id,
    v_sugestao.tipo_match, v_sugestao.extrato_ids, v_sugestao.transacao_ids,
    'aceita', v_sugestao.score, v_sugestao.modelo_versao, p_usuario_id
  );

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.aplicar_sugestao_conciliacao IS 
'Aplica uma sugestão de conciliação aceita pelo usuário e registra feedback.';