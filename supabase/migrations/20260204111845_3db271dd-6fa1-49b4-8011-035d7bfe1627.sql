-- View materializada para dataset de treino
-- Combina extratos + transações conciliadas como exemplos positivos
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_conciliacao_dataset AS
SELECT
  e.id AS extrato_id,
  t.id AS transacao_id,
  e.igreja_id,
  e.filial_id,
  e.conta_id,
  -- Features
  e.valor AS extrato_valor,
  t.valor AS transacao_valor,
  ABS(e.valor - t.valor) AS diferenca_valor,
  CASE 
    WHEN e.valor = t.valor THEN 1.0
    WHEN e.valor = 0 THEN 0.0
    ELSE 1.0 - (ABS(e.valor - t.valor) / GREATEST(ABS(e.valor), ABS(t.valor)))
  END AS similaridade_valor,
  e.data_transacao AS extrato_data,
  t.data_pagamento AS transacao_data,
  ABS(e.data_transacao::date - t.data_pagamento::date) AS diferenca_dias,
  CASE 
    WHEN ABS(e.data_transacao::date - t.data_pagamento::date) = 0 THEN 1.0
    WHEN ABS(e.data_transacao::date - t.data_pagamento::date) <= 3 THEN 0.8
    WHEN ABS(e.data_transacao::date - t.data_pagamento::date) <= 7 THEN 0.5
    ELSE 0.2
  END AS similaridade_data,
  e.descricao AS extrato_descricao,
  t.descricao AS transacao_descricao,
  -- Similaridade de texto simples (word overlap)
  (
    SELECT COUNT(DISTINCT word)::float / GREATEST(COUNT(DISTINCT word), 1)
    FROM (
      SELECT unnest(string_to_array(LOWER(REGEXP_REPLACE(e.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' ')) AS word
      INTERSECT
      SELECT unnest(string_to_array(LOWER(REGEXP_REPLACE(t.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' ')) AS word
    ) AS overlap
  ) AS similaridade_descricao,
  e.tipo AS extrato_tipo,
  t.tipo AS transacao_tipo,
  CASE 
    WHEN (e.tipo = 'credito' AND t.tipo = 'entrada') OR (e.tipo = 'debito' AND t.tipo = 'saida') THEN 1
    ELSE 0
  END AS match_tipo,
  t.categoria_id,
  t.subcategoria_id,
  t.centro_custo_id,
  t.fornecedor_id,
  t.pessoa_id,
  -- Label
  CASE 
    WHEN e.transacao_vinculada_id = t.id THEN 1
    WHEN EXISTS (
      SELECT 1 FROM conciliacoes_lote cl 
      WHERE cl.transacao_id = t.id
    ) THEN 1
    ELSE 0
  END AS label,
  -- Metadata
  e.reconciliado,
  e.created_at AS extrato_created_at,
  t.created_at AS transacao_created_at
FROM extratos_bancarios e
CROSS JOIN transacoes_financeiras t
WHERE 
  e.igreja_id = t.igreja_id
  AND (e.filial_id = t.filial_id OR e.filial_id IS NULL OR t.filial_id IS NULL)
  AND e.conta_id = t.conta_id
  AND t.status = 'pago'
  AND ABS(e.data_transacao::date - t.data_pagamento::date) <= 30
  AND ABS(e.valor - t.valor) <= GREATEST(ABS(e.valor), ABS(t.valor)) * 0.1;

CREATE INDEX IF NOT EXISTS idx_mv_conciliacao_dataset_igreja ON public.mv_conciliacao_dataset(igreja_id);
CREATE INDEX IF NOT EXISTS idx_mv_conciliacao_dataset_conta ON public.mv_conciliacao_dataset(conta_id);
CREATE INDEX IF NOT EXISTS idx_mv_conciliacao_dataset_label ON public.mv_conciliacao_dataset(label);
CREATE INDEX IF NOT EXISTS idx_mv_conciliacao_dataset_extrato ON public.mv_conciliacao_dataset(extrato_id);
CREATE INDEX IF NOT EXISTS idx_mv_conciliacao_dataset_transacao ON public.mv_conciliacao_dataset(transacao_id);

-- View para exemplos positivos (já conciliados)
CREATE OR REPLACE VIEW public.view_conciliacao_exemplos_positivos AS
SELECT 
  extrato_id,
  transacao_id,
  igreja_id,
  filial_id,
  conta_id,
  extrato_valor,
  transacao_valor,
  diferenca_valor,
  similaridade_valor,
  diferenca_dias,
  similaridade_data,
  similaridade_descricao,
  match_tipo,
  categoria_id,
  subcategoria_id
FROM mv_conciliacao_dataset
WHERE label = 1;

-- View para candidatos não conciliados (para inferência)
CREATE OR REPLACE VIEW public.view_conciliacao_candidatos AS
SELECT 
  extrato_id,
  transacao_id,
  igreja_id,
  filial_id,
  conta_id,
  extrato_valor,
  transacao_valor,
  diferenca_valor,
  similaridade_valor,
  diferenca_dias,
  similaridade_data,
  similaridade_descricao,
  match_tipo,
  categoria_id,
  subcategoria_id,
  -- Score heurístico simples
  (
    similaridade_valor * 0.4 +
    similaridade_data * 0.3 +
    COALESCE(similaridade_descricao, 0) * 0.2 +
    match_tipo * 0.1
  ) AS score_heuristico
FROM mv_conciliacao_dataset
WHERE label = 0
AND reconciliado = false;

-- Função para refresh do dataset (rodar manualmente ou via cron)
CREATE OR REPLACE FUNCTION public.refresh_conciliacao_dataset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_conciliacao_dataset;
END;
$$;

COMMENT ON MATERIALIZED VIEW public.mv_conciliacao_dataset IS 
'Dataset de treino para modelo de conciliação. Refresh manual com: SELECT refresh_conciliacao_dataset();';