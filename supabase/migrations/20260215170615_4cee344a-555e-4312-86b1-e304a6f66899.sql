
-- 1. Remover constraint antiga
ALTER TABLE public.conciliacoes_lote_extratos 
DROP CONSTRAINT IF EXISTS conciliacoes_lote_extratos_extrato_id_key;

-- 2. Adicionar nova constraint composta
ALTER TABLE public.conciliacoes_lote_extratos 
ADD CONSTRAINT conciliacoes_lote_extratos_lote_extrato_key 
UNIQUE (conciliacao_lote_id, extrato_id);

-- 3. Adicionar comentário explicativo
COMMENT ON CONSTRAINT conciliacoes_lote_extratos_lote_extrato_key 
ON public.conciliacoes_lote_extratos IS 
'Previne duplicação de vínculos, mas permite que um extrato seja usado em múltiplos lotes (caso 1:N)';
