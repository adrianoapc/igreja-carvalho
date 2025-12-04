
-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "members_can_view_family_members" ON public.profiles;

-- Create security definer function to get user's familia_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_familia_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT familia_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "members_can_view_family_members" ON public.profiles
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR
    (familia_id IS NOT NULL AND familia_id = public.get_user_familia_id(auth.uid()))
  )
);

-- Also fix the dependents insert policy that might cause issues
DROP POLICY IF EXISTS "members_can_create_dependents" ON public.profiles;

CREATE POLICY "members_can_create_dependents" ON public.profiles
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  user_id IS NULL AND
  familia_id IS NOT NULL AND
  familia_id = public.get_user_familia_id(auth.uid())
);

-- Fix the update policy as well
DROP POLICY IF EXISTS "members_can_update_dependents" ON public.profiles;

CREATE POLICY "members_can_update_dependents" ON public.profiles
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  user_id IS NULL AND
  familia_id IS NOT NULL AND
  familia_id = public.get_user_familia_id(auth.uid())
);
