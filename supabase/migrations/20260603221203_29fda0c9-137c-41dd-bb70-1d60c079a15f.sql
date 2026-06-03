
-- Leitura: admins/tesoureiros da igreja, somente se path começa com seu igreja_id
CREATE POLICY "getnet_raw_files_select_admins"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'getnet-raw-files'
    AND (storage.foldername(name))[1] = public.get_current_user_igreja_id()::text
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );
