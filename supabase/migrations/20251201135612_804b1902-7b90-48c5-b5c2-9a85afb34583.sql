-- Adicionar política para permitir que novos usuários criem seu próprio perfil durante o signup
CREATE POLICY "users_can_create_own_profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND auth.uid() IS NOT NULL 
  AND user_id IS NOT NULL
);