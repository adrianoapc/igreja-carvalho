-- Corrigir RLS policies para usar has_role_in_igreja (escopo por igreja)
-- Drop existing policies
DROP POLICY IF EXISTS "Ver integracoes financeiras" ON public.integracoes_financeiras;
DROP POLICY IF EXISTS "Inserir integracoes financeiras" ON public.integracoes_financeiras;
DROP POLICY IF EXISTS "Atualizar integracoes financeiras" ON public.integracoes_financeiras;
DROP POLICY IF EXISTS "Deletar integracoes financeiras" ON public.integracoes_financeiras;

-- Recreate policies using has_role_in_igreja para validar papel na igreja específica
-- SELECT: super_admin global OR admin/tesoureiro na igreja específica
CREATE POLICY "Ver integracoes financeiras"
ON public.integracoes_financeiras FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role_in_igreja(auth.uid(), 'admin'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'admin_igreja'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'tesoureiro'::app_role, igreja_id)
);

-- INSERT: super_admin global OR admin/tesoureiro na igreja específica
CREATE POLICY "Inserir integracoes financeiras"
ON public.integracoes_financeiras FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role_in_igreja(auth.uid(), 'admin'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'admin_igreja'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'tesoureiro'::app_role, igreja_id)
);

-- UPDATE: super_admin global OR admin/tesoureiro na igreja específica
CREATE POLICY "Atualizar integracoes financeiras"
ON public.integracoes_financeiras FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role_in_igreja(auth.uid(), 'admin'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'admin_igreja'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'tesoureiro'::app_role, igreja_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role_in_igreja(auth.uid(), 'admin'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'admin_igreja'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'tesoureiro'::app_role, igreja_id)
);

-- DELETE: super_admin global OR admin/admin_igreja na igreja específica (tesoureiro não pode deletar)
CREATE POLICY "Deletar integracoes financeiras"
ON public.integracoes_financeiras FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role_in_igreja(auth.uid(), 'admin'::app_role, igreja_id)
  OR public.has_role_in_igreja(auth.uid(), 'admin_igreja'::app_role, igreja_id)
);