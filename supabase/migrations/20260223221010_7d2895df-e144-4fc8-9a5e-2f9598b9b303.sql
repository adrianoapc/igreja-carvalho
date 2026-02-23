
-- Fix overly permissive RLS policies for multi-tenant tables

-- 1. evento_subtipos: scope to user's igreja
DROP POLICY IF EXISTS "Leitura publica subtipos" ON public.evento_subtipos;
CREATE POLICY "Subtipos visiveis na igreja"
ON public.evento_subtipos FOR SELECT
TO authenticated
USING (
  igreja_id IN (SELECT p.igreja_id FROM profiles p WHERE p.user_id = auth.uid())
);

-- 2. etapas_jornada: scope to user's igreja
DROP POLICY IF EXISTS "Todos podem ver etapas" ON public.etapas_jornada;
CREATE POLICY "Etapas visiveis na igreja"
ON public.etapas_jornada FOR SELECT
TO authenticated
USING (
  igreja_id IN (SELECT p.igreja_id FROM profiles p WHERE p.user_id = auth.uid())
);

-- NOTE: notificacao_eventos and notificacao_regras are global config tables without igreja_id
-- app_roles, app_permissions, role_permissions are intentionally global system schema
