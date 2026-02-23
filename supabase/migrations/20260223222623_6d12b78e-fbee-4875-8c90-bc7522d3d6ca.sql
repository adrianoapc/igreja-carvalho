
-- Create a restricted view for técnico role (excludes PII)
CREATE OR REPLACE VIEW public.profiles_tecnico_view AS
SELECT 
  id, 
  nome, 
  status, 
  created_at, 
  updated_at, 
  igreja_id, 
  filial_id,
  user_id
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_tecnico_view TO authenticated;

-- Drop the overly permissive técnico policy on profiles
DROP POLICY IF EXISTS "Tecnico ver perfis" ON public.profiles;

-- Create a restricted policy: técnicos can only see non-PII fields via the view
-- They should use profiles_tecnico_view instead of direct table access
-- If they truly need some profile access, restrict to same igreja_id
CREATE POLICY "Tecnico ver perfis da mesma igreja"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'tecnico'::app_role)
  AND igreja_id IN (
    SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);
