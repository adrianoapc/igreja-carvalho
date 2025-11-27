-- Criar bucket para imagens dos banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-images', 'banner-images', true);

-- Criar tabela de banners se não existir
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Policies para banners
CREATE POLICY "Todos podem ver banners ativos"
ON public.banners FOR SELECT
USING (active = true OR auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem criar banners"
ON public.banners FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar banners"
ON public.banners FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar banners"
ON public.banners FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies para banner-images
CREATE POLICY "Todos podem ver imagens de banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'banner-images');

CREATE POLICY "Admins podem fazer upload de imagens"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'banner-images' AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins podem deletar imagens"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'banner-images' AND
  public.has_role(auth.uid(), 'admin')
);