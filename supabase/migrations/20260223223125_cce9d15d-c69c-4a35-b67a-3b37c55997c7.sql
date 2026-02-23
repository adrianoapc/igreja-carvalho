
-- Drop the recursive policy immediately
DROP POLICY IF EXISTS "Tecnico ver perfis da mesma igreja" ON public.profiles;

-- Create a SECURITY DEFINER function to get the user's igreja_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_current_user_igreja_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_user_igreja_id FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_igreja_id TO authenticated;

-- Recreate the policy using the non-recursive function
CREATE POLICY "Tecnico ver perfis da mesma igreja"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'tecnico'::app_role)
  AND igreja_id = public.get_current_user_igreja_id()
);
