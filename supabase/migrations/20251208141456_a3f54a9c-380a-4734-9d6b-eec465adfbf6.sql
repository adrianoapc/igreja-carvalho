-- Policy para permitir membros autenticados criarem perfis de dependentes/familiares
CREATE POLICY "members_can_create_family_profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Permite criar perfis sem user_id (dependentes) ou próprio perfil
  user_id IS NULL OR user_id = auth.uid()
);