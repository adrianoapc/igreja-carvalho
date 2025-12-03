-- Adicionando os canais de distribuição
ALTER TABLE public.comunicados 
ADD COLUMN IF NOT EXISTS exibir_app BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS exibir_telao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exibir_site BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS url_arquivo_telao TEXT,
ADD COLUMN IF NOT EXISTS ordem_telao INTEGER DEFAULT 0;

-- Categorização de mídia
ALTER TABLE public.comunicados 
ADD COLUMN IF NOT EXISTS categoria_midia TEXT DEFAULT 'geral';

-- Comentários para documentação
COMMENT ON COLUMN public.comunicados.exibir_app IS 'Exibe no Dashboard do App';
COMMENT ON COLUMN public.comunicados.exibir_telao IS 'Vai para a playlist do ProPresenter/Telão';
COMMENT ON COLUMN public.comunicados.exibir_site IS 'Vai para o carrossel do site';
COMMENT ON COLUMN public.comunicados.url_arquivo_telao IS 'Arte alternativa para telão (ex: 16:9 vs 9:16)';
COMMENT ON COLUMN public.comunicados.ordem_telao IS 'Ordem na playlist do telão';
COMMENT ON COLUMN public.comunicados.categoria_midia IS 'Categoria: geral, eventos, liturgia';