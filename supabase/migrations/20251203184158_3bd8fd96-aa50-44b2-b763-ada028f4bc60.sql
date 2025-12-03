-- Adiciona suporte a tags para filtrar por tipo
ALTER TABLE public.comunicados 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Adiciona vínculo opcional com um culto específico
ALTER TABLE public.comunicados 
ADD COLUMN IF NOT EXISTS culto_id UUID REFERENCES public.cultos(id) ON DELETE SET NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.comunicados.tags IS 'Tags para categorização: Abertura, Louvor, Avisos Gerais, etc.';
COMMENT ON COLUMN public.comunicados.culto_id IS 'Vínculo opcional com culto específico';