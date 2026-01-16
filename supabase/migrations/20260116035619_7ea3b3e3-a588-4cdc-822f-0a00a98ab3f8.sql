-- Adicionar campos para sincronização API à tabela extratos_bancarios
ALTER TABLE public.extratos_bancarios 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS import_job_id UUID,
ADD COLUMN IF NOT EXISTS transacao_vinculada_id UUID;

-- Criar índice único para deduplicação por conta + external_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_extratos_bancarios_dedupe 
ON public.extratos_bancarios(conta_id, external_id) 
WHERE external_id IS NOT NULL;

-- Adicionar constraint de foreign key para transacao_vinculada_id (opcional)
-- ALTER TABLE public.extratos_bancarios 
-- ADD CONSTRAINT fk_transacao_vinculada 
-- FOREIGN KEY (transacao_vinculada_id) REFERENCES public.transacoes_financeiras(id);

-- Comentários para documentação
COMMENT ON COLUMN public.extratos_bancarios.external_id IS 'ID único da transação no provedor (FITID/transactionId)';
COMMENT ON COLUMN public.extratos_bancarios.origem IS 'Origem do registro: manual, api_santander, arquivo_ofx, arquivo_csv';
COMMENT ON COLUMN public.extratos_bancarios.import_job_id IS 'ID do job de importação para rastreabilidade';
COMMENT ON COLUMN public.extratos_bancarios.transacao_vinculada_id IS 'FK para transação conciliada';

-- Criar função RPC para conciliação automática
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
        WHEN e.valor = t.valor AND e.data_transacao::date = t.data::date THEN 100
        -- Match de valor com tolerância de data = 80 pontos
        WHEN e.valor = t.valor AND ABS(e.data_transacao::date - t.data::date) <= p_tolerancia_dias THEN 80
        -- Match de data com tolerância de valor = 70 pontos
        WHEN e.data_transacao::date = t.data::date AND ABS(e.valor - t.valor) <= p_tolerancia_valor THEN 70
        -- Match com ambas tolerâncias = 50 pontos
        WHEN ABS(e.data_transacao::date - t.data::date) <= p_tolerancia_dias 
             AND ABS(e.valor - t.valor) <= p_tolerancia_valor THEN 50
        ELSE 0
      END AS match_score
    FROM extratos_bancarios e
    INNER JOIN transacoes_financeiras t ON t.conta_id = e.conta_id
    WHERE e.conta_id = p_conta_id
      AND e.reconciliado = FALSE
      AND e.transacao_vinculada_id IS NULL
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

-- Criar função para aplicar conciliação
CREATE OR REPLACE FUNCTION public.aplicar_conciliacao(
  p_extrato_id UUID,
  p_transacao_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE extratos_bancarios
  SET 
    reconciliado = TRUE,
    transacao_vinculada_id = p_transacao_id
  WHERE id = p_extrato_id
    AND reconciliado = FALSE;
  
  RETURN FOUND;
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.reconciliar_transacoes(UUID, NUMERIC, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_conciliacao(UUID, UUID) TO authenticated;