-- Criar índice único para permitir refresh concorrente da materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_conciliacao_dataset_unique 
ON public.mv_conciliacao_dataset (extrato_id, transacao_id);