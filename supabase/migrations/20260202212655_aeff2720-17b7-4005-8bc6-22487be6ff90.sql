-- Adicionar coluna para marcação manual de conferência
ALTER TABLE public.transacoes_financeiras
ADD COLUMN IF NOT EXISTS conferido_manual BOOLEAN NOT NULL DEFAULT false;

-- Comentário descritivo
COMMENT ON COLUMN public.transacoes_financeiras.conferido_manual IS 
'Marcador manual de conferência para pagamentos em dinheiro.';