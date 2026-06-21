-- Permitir que usuários autenticados possam criar/atualizar seu próprio perfil durante signup
-- Isso resolve o problema de RLS durante o cadastro de novos usuários

-- Política para permitir INSERT do próprio perfil
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON public.profiles;

CREATE POLICY "users_can_insert_own_profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Política para permitir UPDATE do próprio perfil (upsert)
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;

CREATE POLICY "users_can_update_own_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política para permitir SELECT do próprio perfil
DROP POLICY IF EXISTS "users_can_view_own_profile" ON public.profiles;

CREATE POLICY "users_can_view_own_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
