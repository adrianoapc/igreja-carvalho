-- Criar tabela para categorias de times
CREATE TABLE public.categorias_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT '#8B5CF6',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.categorias_times ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver categorias ativas"
  ON public.categorias_times
  FOR SELECT
  USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar categorias"
  ON public.categorias_times
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_categorias_times_updated_at
  BEFORE UPDATE ON public.categorias_times
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir categorias padrão
INSERT INTO public.categorias_times (nome, cor) VALUES
  ('Música', '#8B5CF6'),
  ('Técnico', '#3B82F6'),
  ('Kids', '#EC4899'),
  ('Hospitalidade', '#10B981'),
  ('Outro', '#6B7280');