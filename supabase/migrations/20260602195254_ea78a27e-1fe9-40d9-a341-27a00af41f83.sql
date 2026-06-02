
-- 1. Tighten cross-church reads on financial config tables
DROP POLICY IF EXISTS "Usuarios autenticados podem ver bases ministeriais ativas" ON public.bases_ministeriais;
CREATE POLICY "Usuarios podem ver bases ministeriais da igreja"
  ON public.bases_ministeriais FOR SELECT
  USING (auth.uid() IS NOT NULL AND ativo = true AND has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Usuarios autenticados podem ver categorias ativas" ON public.categorias_financeiras;
CREATE POLICY "Usuarios podem ver categorias da igreja"
  ON public.categorias_financeiras FOR SELECT
  USING (auth.uid() IS NOT NULL AND ativo = true AND has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Usuarios autenticados podem ver centros custo ativos" ON public.centros_custo;
CREATE POLICY "Usuarios podem ver centros custo da igreja"
  ON public.centros_custo FOR SELECT
  USING (auth.uid() IS NOT NULL AND ativo = true AND has_filial_access(igreja_id, filial_id));

-- 2. Suppliers: remove unscoped SELECT, scope admin/treasurer SELECT to church/branch
DROP POLICY IF EXISTS "Usuarios autenticados podem ver fornecedores ativos" ON public.fornecedores;
DROP POLICY IF EXISTS "only_admins_treasurers_can_view_suppliers" ON public.fornecedores;
CREATE POLICY "only_admins_treasurers_can_view_suppliers"
  ON public.fornecedores FOR SELECT
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND auth.uid() IS NOT NULL
    AND has_filial_access(igreja_id, filial_id)
  );

-- 3. PIX webhook temp: block public INSERT (edge function uses service_role, which bypasses RLS)
DROP POLICY IF EXISTS "pix_webhook_temp_insert" ON public.pix_webhook_temp;

-- 4. profile_contatos: drop cross-member read, allow only own
DROP POLICY IF EXISTS "Users can view contacts from same church" ON public.profile_contatos;
CREATE POLICY "Users can view their own contacts"
  ON public.profile_contatos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = profile_contatos.profile_id
      AND profiles.user_id = auth.uid()
  ));

-- 5. transaction-attachments bucket: drop generic authenticated-only policies
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;

-- 6. comunicados bucket: require admin role (not just any authenticated user)
DROP POLICY IF EXISTS "comunicados_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "comunicados_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "comunicados_admin_delete" ON storage.objects;

CREATE POLICY "comunicados_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comunicados' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "comunicados_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comunicados' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "comunicados_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comunicados' AND has_role(auth.uid(), 'admin'::app_role));
