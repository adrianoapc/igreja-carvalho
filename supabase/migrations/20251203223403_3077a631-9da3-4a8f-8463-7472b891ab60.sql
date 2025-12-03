-- Adicionar campo permite_multiplo à liturgia_culto para controlar comportamento single vs multi
ALTER TABLE public.liturgia_culto 
ADD COLUMN IF NOT EXISTS permite_multiplo BOOLEAN NOT NULL DEFAULT false;

-- Atualizar itens do tipo "avisos" ou "anuncios" para permitir múltiplos por padrão
UPDATE public.liturgia_culto 
SET permite_multiplo = true 
WHERE LOWER(tipo) IN ('avisos', 'anuncios', 'anúncios', 'comunicados');

-- Criar índice para performance na busca de recursos por item
CREATE INDEX IF NOT EXISTS idx_liturgia_recursos_item_ordem 
ON public.liturgia_recursos(liturgia_item_id, ordem);

-- Criar índice para busca de recursos por mídia
CREATE INDEX IF NOT EXISTS idx_liturgia_recursos_midia 
ON public.liturgia_recursos(midia_id);

-- Comentários para documentação
COMMENT ON COLUMN public.liturgia_culto.permite_multiplo IS 'Se true, permite vincular múltiplas mídias ao item. Se false, apenas uma mídia (substituição).';
COMMENT ON TABLE public.liturgia_recursos IS 'Tabela de relacionamento N:N entre itens de liturgia e mídias, com ordenação para playlist.';
COMMENT ON COLUMN public.liturgia_recursos.ordem IS 'Ordem de exibição da mídia na playlist do item.';
COMMENT ON COLUMN public.liturgia_recursos.duracao_segundos IS 'Duração de exibição para slideshow automático.';