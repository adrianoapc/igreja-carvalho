-- Permitir que usuários autenticados criem perfis para dependentes (sem user_id)
CREATE POLICY "members_can_create_dependents"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id IS NULL 
  AND familia_id IS NOT NULL
);

-- Permitir que membros criem relacionamentos familiares para si próprios
DROP POLICY IF EXISTS "Admins podem criar relacionamentos familiares" ON public.familias;

CREATE POLICY "members_can_create_family_relationships"
ON public.familias
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Permitir que membros atualizem seus próprios dependentes (via familia_id)
CREATE POLICY "members_can_update_dependents"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND user_id IS NULL 
  AND familia_id IN (SELECT familia_id FROM profiles WHERE user_id = auth.uid() AND familia_id IS NOT NULL)
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id IS NULL 
  AND familia_id IN (SELECT familia_id FROM profiles WHERE user_id = auth.uid() AND familia_id IS NOT NULL)
);

-- Permitir que membros vejam seus dependentes (mesmo familia_id)
CREATE POLICY "members_can_view_family_members"
ON public.profiles
FOR SELECT
USING (
  familia_id IS NOT NULL 
  AND familia_id IN (SELECT familia_id FROM profiles WHERE user_id = auth.uid() AND familia_id IS NOT NULL)
);

-- Manter política de admin para familias
CREATE POLICY "admins_can_manage_families"
ON public.familias
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));