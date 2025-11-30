-- Criar tabela de configurações da igreja
CREATE TABLE IF NOT EXISTS public.configuracoes_igreja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_igreja TEXT NOT NULL DEFAULT 'Igreja App',
  subtitulo TEXT DEFAULT 'Gestão Completa',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.configuracoes_igreja (nome_igreja, subtitulo)
VALUES ('Igreja App', 'Gestão Completa')
ON CONFLICT DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.configuracoes_igreja ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver configurações"
  ON public.configuracoes_igreja
  FOR SELECT
  USING (true);

CREATE POLICY "Admins podem atualizar configurações"
  ON public.configuracoes_igreja
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_configuracoes_igreja_updated_at
  BEFORE UPDATE ON public.configuracoes_igreja
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket para logo da igreja
INSERT INTO storage.buckets (id, name, public)
VALUES ('igreja-logo', 'igreja-logo', true)
ON CONFLICT DO NOTHING;

-- Políticas de storage para o bucket igreja-logo
CREATE POLICY "Logo público para leitura"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'igreja-logo');

CREATE POLICY "Admins podem fazer upload do logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'igreja-logo' 
    AND has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins podem atualizar logo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'igreja-logo' 
    AND has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins podem deletar logo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'igreja-logo' 
    AND has_role(auth.uid(), 'admin')
  );