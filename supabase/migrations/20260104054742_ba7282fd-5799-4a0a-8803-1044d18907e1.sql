-- Migration: Adicionar igreja_id nas tabelas restantes

-- presencas_aula
ALTER TABLE public.presencas_aula 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.presencas_aula 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_presencas_aula_igreja_id 
  ON public.presencas_aula(igreja_id);

-- tags_midias
ALTER TABLE public.tags_midias 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.tags_midias 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tags_midias_igreja_id 
  ON public.tags_midias(igreja_id);