-- Restore SELECT access for church staff on profile_contatos.
-- Migration 20260602195254 tightened the SELECT policy to "own contacts only",
-- which broke the Todos/Membros/Visitantes listing pages for non-admin users.
-- Add a policy that mirrors the has_filial_access pattern used by profiles,
-- escalas, and other people-management tables.

DROP POLICY IF EXISTS "Church staff can view contacts in same filial" ON public.profile_contatos;

CREATE POLICY "Church staff can view contacts in same filial"
ON public.profile_contatos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = profile_contatos.profile_id
      AND has_filial_access(profiles.igreja_id, profiles.filial_id)
  )
);
