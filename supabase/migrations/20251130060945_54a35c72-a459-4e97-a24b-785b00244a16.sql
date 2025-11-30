-- Criar tabela de tags de mídias
CREATE TABLE public.tags_midias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT DEFAULT '#8B5CF6',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de relacionamento mídia-tags (muitos para muitos)
CREATE TABLE public.midia_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  midia_id UUID NOT NULL REFERENCES public.midias(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags_midias(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(midia_id, tag_id)
);

-- Habilitar RLS
ALTER TABLE public.tags_midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midia_tags ENABLE ROW LEVEL SECURITY;

-- Políticas para tags_midias
CREATE POLICY "Admins podem gerenciar tags de mídias"
  ON public.tags_midias
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem ver tags ativas"
  ON public.tags_midias
  FOR SELECT
  USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

-- Políticas para midia_tags
CREATE POLICY "Admins podem gerenciar relação mídia-tags"
  ON public.midia_tags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem ver relações mídia-tags"
  ON public.midia_tags
  FOR SELECT
  USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_tags_midias_updated_at
  BEFORE UPDATE ON public.tags_midias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir tags padrão
INSERT INTO public.tags_midias (nome, cor) VALUES
  ('Abertura', '#3B82F6'),
  ('Louvor', '#8B5CF6'),
  ('Adoração', '#EC4899'),
  ('Pregação', '#10B981'),
  ('Oferta', '#F59E0B'),
  ('Encerramento', '#6366F1'),
  ('Eventos Especiais', '#EF4444'),
  ('Aniversariantes', '#14B8A6'),
  ('Avisos Gerais', '#6B7280');

-- Comentários
COMMENT ON TABLE public.tags_midias IS 'Tags/categorias para organização de mídias';
COMMENT ON TABLE public.midia_tags IS 'Relacionamento muitos-para-muitos entre mídias e tags';