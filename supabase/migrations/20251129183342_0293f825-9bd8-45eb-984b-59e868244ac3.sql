-- Criar enum para tipos de sentimentos
CREATE TYPE sentimento_tipo AS ENUM (
  'feliz',
  'cuidadoso',
  'abencoado',
  'grato',
  'angustiado',
  'sozinho',
  'triste',
  'doente',
  'com_pouca_fe'
);

-- Criar tabela de registros de sentimentos
CREATE TABLE public.sentimentos_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sentimento sentimento_tipo NOT NULL,
  mensagem TEXT,
  data_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.sentimentos_membros ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todos os sentimentos
CREATE POLICY "Admins podem ver todos os sentimentos"
  ON public.sentimentos_membros
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Membros podem criar seus próprios registros de sentimentos
CREATE POLICY "Membros podem criar seus sentimentos"
  ON public.sentimentos_membros
  FOR INSERT
  WITH CHECK (
    pessoa_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Membros podem ver seus próprios sentimentos
CREATE POLICY "Membros podem ver seus próprios sentimentos"
  ON public.sentimentos_membros
  FOR SELECT
  USING (
    pessoa_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sentimentos_membros_updated_at
  BEFORE UPDATE ON public.sentimentos_membros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX idx_sentimentos_membros_pessoa_id ON public.sentimentos_membros(pessoa_id);
CREATE INDEX idx_sentimentos_membros_data_registro ON public.sentimentos_membros(data_registro DESC);
CREATE INDEX idx_sentimentos_membros_sentimento ON public.sentimentos_membros(sentimento);