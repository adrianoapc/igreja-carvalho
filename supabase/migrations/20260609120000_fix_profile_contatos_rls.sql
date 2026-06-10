-- Restore SELECT access for church staff on profile_contatos.
-- Migration 20260602195254 tightened the SELECT policy to "own contacts only",
-- which broke the Todos/Membros/Visitantes listing pages for non-admin users.
-- Add a policy that mirrors the has_filial_access pattern used by profiles,
-- escalas, and other people-management tables, but additionally requires a
-- staff role: has_filial_access alone returns true for any member of the
-- same filial (and even cross-church for users with null tenant claims), so
-- it's not sufficient to gate access to other people's contacts.

DROP POLICY IF EXISTS "Church staff can view contacts in same filial" ON public.profile_contatos;

CREATE POLICY "Church staff can view contacts in same filial"
ON public.profile_contatos FOR SELECT
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin_igreja'::app_role)
    OR has_role(auth.uid(), 'pastor'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
    OR has_role(auth.uid(), 'secretario'::app_role)
    OR has_role(auth.uid(), 'tesoureiro'::app_role)
    OR has_role(auth.uid(), 'professor'::app_role)
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = profile_contatos.profile_id
      AND has_filial_access(profiles.igreja_id, profiles.filial_id)
  )
);
