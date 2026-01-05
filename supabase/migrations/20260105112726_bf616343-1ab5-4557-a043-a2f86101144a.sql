-- Atualizar função has_permission para suportar novo sistema de permissões
-- e incluir admin_igreja como role com acesso total

CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _permission_slug TEXT
) RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1. Verificar se é admin/super_admin/admin_igreja (acesso total)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id 
      AND ur.role IN ('admin'::app_role, 'super_admin'::app_role, 'admin_igreja'::app_role)
  )
  OR EXISTS (
    -- 2. Verificar permissões via user_roles → app_roles → role_permissions
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.app_roles ar ON ar.name = ur.role::text
    INNER JOIN public.role_permissions rp ON rp.role_id = ar.id
    INNER JOIN public.app_permissions ap ON ap.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND ap.key = _permission_slug
  )
  OR EXISTS (
    -- 3. Verificar permissões via user_app_roles (novo sistema direto)
    SELECT 1
    FROM public.user_app_roles uar
    INNER JOIN public.role_permissions rp ON uar.role_id = rp.role_id
    INNER JOIN public.app_permissions ap ON rp.permission_id = ap.id
    WHERE uar.user_id = _user_id
      AND ap.key = _permission_slug
  );
$$;

COMMENT ON FUNCTION public.has_permission IS 'Verifica se usuário tem permissão específica via roles (admin bypass) ou sistema de permissões granular';