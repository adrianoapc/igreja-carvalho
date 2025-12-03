-- Criar bucket para anexos de transações
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-attachments',
  'transaction-attachments',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'transaction-attachments');

CREATE POLICY "Allow authenticated upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'transaction-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update" ON storage.objects
FOR UPDATE USING (bucket_id = 'transaction-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete" ON storage.objects
FOR DELETE USING (bucket_id = 'transaction-attachments' AND auth.role() = 'authenticated');