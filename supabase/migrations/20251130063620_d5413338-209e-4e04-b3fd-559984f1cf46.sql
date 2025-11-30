-- Adicionar campo de categoria aos templates
ALTER TABLE public.templates_culto 
ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Geral';

-- Criar índice para melhorar performance de busca por categoria
CREATE INDEX IF NOT EXISTS idx_templates_culto_categoria 
ON public.templates_culto(categoria) WHERE ativo = true;