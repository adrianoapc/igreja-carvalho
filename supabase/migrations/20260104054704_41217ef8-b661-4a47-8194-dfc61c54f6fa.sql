-- Migration: Adicionar igreja_id nas tabelas que precisam (Parte 1)

-- alteracoes_perfil_pendentes
ALTER TABLE public.alteracoes_perfil_pendentes 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.alteracoes_perfil_pendentes 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_alteracoes_perfil_pendentes_igreja_id 
  ON public.alteracoes_perfil_pendentes(igreja_id);

-- candidatos_voluntario_historico
ALTER TABLE public.candidatos_voluntario_historico 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.candidatos_voluntario_historico 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_candidatos_voluntario_historico_igreja_id 
  ON public.candidatos_voluntario_historico(igreja_id);

-- etapas_jornada
ALTER TABLE public.etapas_jornada 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.etapas_jornada 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_etapas_jornada_igreja_id 
  ON public.etapas_jornada(igreja_id);

-- evento_subtipos
ALTER TABLE public.evento_subtipos 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.evento_subtipos 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_evento_subtipos_igreja_id 
  ON public.evento_subtipos(igreja_id);

-- liturgia_recursos
ALTER TABLE public.liturgia_recursos 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.liturgia_recursos 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_liturgia_recursos_igreja_id 
  ON public.liturgia_recursos(igreja_id);

-- liturgia_templates
ALTER TABLE public.liturgia_templates 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.liturgia_templates 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_liturgia_templates_igreja_id 
  ON public.liturgia_templates(igreja_id);

-- midia_tags
ALTER TABLE public.midia_tags 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.midia_tags 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_midia_tags_igreja_id 
  ON public.midia_tags(igreja_id);