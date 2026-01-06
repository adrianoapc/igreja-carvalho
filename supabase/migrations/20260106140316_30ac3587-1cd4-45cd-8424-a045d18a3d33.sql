-- Adicionar coluna is_sede na tabela filiais
ALTER TABLE public.filiais 
ADD COLUMN IF NOT EXISTS is_sede BOOLEAN DEFAULT false;