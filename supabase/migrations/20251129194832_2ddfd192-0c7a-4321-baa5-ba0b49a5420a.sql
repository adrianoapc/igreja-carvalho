-- Criar bucket de storage para anexos de transações
INSERT INTO storage.buckets (id, name, public)
VALUES ('transacoes-anexos', 'transacoes-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Criar política para permitir que admins e tesoureiros façam upload
CREATE POLICY "Admins e tesoureiros podem fazer upload de anexos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'transacoes-anexos' AND
  (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'tesoureiro')
  )
);

-- Criar política para permitir que admins e tesoureiros visualizem anexos
CREATE POLICY "Admins e tesoureiros podem ver anexos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'transacoes-anexos' AND
  (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'tesoureiro')
  )
);

-- Criar política para permitir que admins e tesoureiros deletem anexos
CREATE POLICY "Admins e tesoureiros podem deletar anexos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'transacoes-anexos' AND
  (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'tesoureiro')
  )
);