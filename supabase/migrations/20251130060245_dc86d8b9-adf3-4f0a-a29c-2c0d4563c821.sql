-- Adicionar campo para vincular múltiplas mídias aos itens de liturgia
ALTER TABLE public.liturgia_culto
ADD COLUMN midias_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN public.liturgia_culto.midias_ids IS 'IDs das mídias relacionadas ao item de liturgia (vídeos, imagens, documentos)';