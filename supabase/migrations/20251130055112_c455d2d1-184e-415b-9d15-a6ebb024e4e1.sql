-- Renomear tabela midias_culto para midias
ALTER TABLE public.midias_culto RENAME TO midias;

-- Adicionar campos para gerenciamento de mídias
ALTER TABLE public.midias
  ADD COLUMN canal TEXT NOT NULL DEFAULT 'telao',
  ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT true;

-- Adicionar constraint para validar canais permitidos
ALTER TABLE public.midias
  ADD CONSTRAINT midias_canal_check 
  CHECK (canal IN ('app', 'redes_sociais', 'telao', 'site'));

-- Criar índices para melhor performance
CREATE INDEX idx_midias_canal ON public.midias(canal);
CREATE INDEX idx_midias_ativo ON public.midias(ativo);
CREATE INDEX idx_midias_ordem ON public.midias(ordem);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.midias.canal IS 'Canal de exibição: app, redes_sociais, telao, site';
COMMENT ON COLUMN public.midias.ordem IS 'Ordem de exibição (drag-and-drop)';
COMMENT ON COLUMN public.midias.ativo IS 'Define se a mídia está ativa para exibição';

-- Atualizar trigger de updated_at se existir
DROP TRIGGER IF EXISTS update_midias_culto_updated_at ON public.midias;
CREATE TRIGGER update_midias_updated_at
  BEFORE UPDATE ON public.midias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();