
ALTER TABLE public.importacao_transacoes_temp 
ADD COLUMN IF NOT EXISTS numero_documento TEXT;
