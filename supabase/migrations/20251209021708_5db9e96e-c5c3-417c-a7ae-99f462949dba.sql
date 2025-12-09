-- Security Fix 1: Make transaction-attachments bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'transaction-attachments';

-- Remove the overly permissive public read policy
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;

-- Add secure policy for authenticated admin/tesoureiro to read transaction attachments
CREATE POLICY "Admins and treasurers can read transaction attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'transaction-attachments' 
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
  )
);

-- Add secure policy for authenticated admin/tesoureiro to upload transaction attachments
CREATE POLICY "Admins and treasurers can upload transaction attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'transaction-attachments' 
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
  )
);

-- Add secure policy for authenticated admin/tesoureiro to update transaction attachments
CREATE POLICY "Admins and treasurers can update transaction attachments"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'transaction-attachments' 
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR 
    public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
  )
);

-- Add secure policy for admins to delete transaction attachments
CREATE POLICY "Admins can delete transaction attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'transaction-attachments' 
  AND auth.uid() IS NOT NULL
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);