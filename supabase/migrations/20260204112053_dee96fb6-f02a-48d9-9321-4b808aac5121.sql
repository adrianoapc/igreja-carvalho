-- View para métricas de performance do modelo
CREATE OR REPLACE VIEW public.view_conciliacao_ml_metricas AS
SELECT 
  f.igreja_id,
  f.filial_id,
  f.conta_id,
  DATE_TRUNC('month', f.created_at) AS periodo,
  f.modelo_versao,
  COUNT(*) AS total_sugestoes,
  COUNT(*) FILTER (WHERE f.acao = 'aceita') AS aceitas,
  COUNT(*) FILTER (WHERE f.acao = 'rejeitada') AS rejeitadas,
  COUNT(*) FILTER (WHERE f.acao = 'ajustada') AS ajustadas,
  ROUND(
    (COUNT(*) FILTER (WHERE f.acao = 'aceita')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
    2
  ) AS taxa_aceitacao,
  AVG(f.score) FILTER (WHERE f.acao = 'aceita') AS score_medio_aceitas,
  AVG(f.score) FILTER (WHERE f.acao = 'rejeitada') AS score_medio_rejeitadas,
  AVG(f.score) AS score_medio_geral,
  COUNT(DISTINCT f.usuario_id) AS usuarios_ativos
FROM conciliacao_ml_feedback f
GROUP BY f.igreja_id, f.filial_id, f.conta_id, DATE_TRUNC('month', f.created_at), f.modelo_versao;

COMMENT ON VIEW public.view_conciliacao_ml_metricas IS 
'Métricas agregadas de performance do modelo de conciliação por período e versão.';

-- View para análise de features mais relevantes
CREATE OR REPLACE VIEW public.view_conciliacao_ml_features_stats AS
SELECT 
  f.igreja_id,
  f.tipo_match,
  f.acao,
  COUNT(*) AS quantidade,
  AVG((f.ajustes->>'diferenca_dias')::numeric) AS diferenca_dias_media,
  AVG((f.ajustes->>'diferenca_valor')::numeric) AS diferenca_valor_media,
  COUNT(*) FILTER (WHERE (f.ajustes->>'match_tipo')::boolean = true) AS match_tipo_count,
  AVG(f.score) AS score_medio
FROM conciliacao_ml_feedback f
WHERE f.ajustes IS NOT NULL
GROUP BY f.igreja_id, f.tipo_match, f.acao;

COMMENT ON VIEW public.view_conciliacao_ml_features_stats IS 
'Estatísticas de features por tipo de match e ação do usuário.';

-- View para dashboard de conciliação inteligente
CREATE OR REPLACE VIEW public.view_conciliacao_ml_dashboard AS
WITH sugestoes_pendentes AS (
  SELECT 
    igreja_id,
    filial_id,
    conta_id,
    COUNT(*) AS total_pendentes,
    COUNT(*) FILTER (WHERE score >= 0.9) AS alto_score,
    COUNT(*) FILTER (WHERE score >= 0.7 AND score < 0.9) AS medio_score,
    COUNT(*) FILTER (WHERE score < 0.7) AS baixo_score,
    SUM(array_length(extrato_ids, 1)) AS total_extratos,
    SUM(array_length(transacao_ids, 1)) AS total_transacoes
  FROM conciliacao_ml_sugestoes
  WHERE status = 'pendente'
  GROUP BY igreja_id, filial_id, conta_id
),
feedback_recente AS (
  SELECT 
    igreja_id,
    filial_id,
    conta_id,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS feedback_7dias,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') AS feedback_30dias,
    AVG(score) FILTER (WHERE acao = 'aceita' AND created_at >= CURRENT_DATE - INTERVAL '30 days') AS score_medio_aceitas_30d
  FROM conciliacao_ml_feedback
  GROUP BY igreja_id, filial_id, conta_id
),
extratos_pendentes AS (
  SELECT 
    igreja_id,
    filial_id,
    conta_id,
    COUNT(*) AS total_nao_conciliados,
    SUM(ABS(valor)) AS valor_pendente
  FROM extratos_bancarios
  WHERE reconciliado = false AND transacao_vinculada_id IS NULL
  GROUP BY igreja_id, filial_id, conta_id
)
SELECT 
  COALESCE(s.igreja_id, f.igreja_id, e.igreja_id) AS igreja_id,
  COALESCE(s.filial_id, f.filial_id, e.filial_id) AS filial_id,
  COALESCE(s.conta_id, f.conta_id, e.conta_id) AS conta_id,
  c.nome AS conta_nome,
  COALESCE(s.total_pendentes, 0) AS sugestoes_pendentes,
  COALESCE(s.alto_score, 0) AS sugestoes_alto_score,
  COALESCE(s.medio_score, 0) AS sugestoes_medio_score,
  COALESCE(s.baixo_score, 0) AS sugestoes_baixo_score,
  COALESCE(e.total_nao_conciliados, 0) AS extratos_nao_conciliados,
  COALESCE(e.valor_pendente, 0) AS valor_pendente,
  COALESCE(f.feedback_7dias, 0) AS feedback_7dias,
  COALESCE(f.feedback_30dias, 0) AS feedback_30dias,
  f.score_medio_aceitas_30d,
  CASE 
    WHEN COALESCE(s.total_pendentes, 0) > 0 THEN 
      ROUND((COALESCE(s.alto_score, 0)::NUMERIC / s.total_pendentes) * 100, 2)
    ELSE 0
  END AS percentual_alta_confianca
FROM sugestoes_pendentes s
FULL OUTER JOIN feedback_recente f USING (igreja_id, filial_id, conta_id)
FULL OUTER JOIN extratos_pendentes e USING (igreja_id, filial_id, conta_id)
LEFT JOIN contas c ON c.id = COALESCE(s.conta_id, f.conta_id, e.conta_id);

COMMENT ON VIEW public.view_conciliacao_ml_dashboard IS 
'Dashboard agregado de conciliação inteligente com sugestões, feedback e status.';

-- View para exportação de dataset (para treino externo)
CREATE OR REPLACE VIEW public.view_conciliacao_ml_export_dataset AS
SELECT 
  d.extrato_id,
  d.transacao_id,
  d.igreja_id,
  d.conta_id,
  d.extrato_valor,
  d.transacao_valor,
  d.diferenca_valor,
  d.similaridade_valor,
  d.diferenca_dias,
  d.similaridade_data,
  d.similaridade_descricao,
  d.extrato_tipo,
  d.transacao_tipo,
  d.match_tipo,
  d.label,
  COALESCE(cat.nome, '') AS categoria_nome,
  COALESCE(subcat.nome, '') AS subcategoria_nome
FROM mv_conciliacao_dataset d
LEFT JOIN categorias_financeiras cat ON cat.id = d.categoria_id
LEFT JOIN subcategorias_financeiras subcat ON subcat.id = d.subcategoria_id
WHERE d.label = 1 OR (d.label = 0 AND d.reconciliado = false);

COMMENT ON VIEW public.view_conciliacao_ml_export_dataset IS 
'Dataset exportável para treino de modelo ML externo (positivos + negativos não conciliados).';