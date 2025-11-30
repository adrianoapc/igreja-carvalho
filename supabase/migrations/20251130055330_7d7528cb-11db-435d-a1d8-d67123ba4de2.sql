-- Criar bucket de storage para mídias
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'midias',
  'midias',
  true,
  20971520, -- 20MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para mídias
CREATE POLICY "Públicas podem ver mídias"
ON storage.objects FOR SELECT
USING (bucket_id = 'midias');

CREATE POLICY "Admins podem fazer upload de mídias"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'midias' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem atualizar mídias"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'midias' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem deletar mídias"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'midias' 
  AND has_role(auth.uid(), 'admin'::app_role)
);