-- Adicionar coluna ativo na tabela filiais
ALTER TABLE public.filiais 
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;