
-- =====================================================
-- MIGRAÇÃO: Sistema RBAC - Complementar
-- =====================================================

-- 2. FUNÇÃO RPC DE SEGURANÇA: has_permission
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Verifica se é admin (admin tem todas as permissões)
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'admin'::app_role
  )
  OR EXISTS (
    -- Verifica se tem a permissão específica via role
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.app_roles ar ON ar.name = ur.role::text
    INNER JOIN public.role_permissions rp ON rp.role_id = ar.id
    INNER JOIN public.app_permissions ap ON ap.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND ap.key = _permission_slug
  )
$$;

COMMENT ON FUNCTION public.has_permission IS 'Verifica se um usuário tem uma permissão específica. Admins têm todas as permissões automaticamente.';

-- 3. SEED DATA: ROLES
-- =====================================================
INSERT INTO public.app_roles (name, description, is_system)
VALUES 
  ('admin', 'Acesso total ao sistema', true),
  ('pastor', 'Acesso pastoral e gabinete', true),
  ('lider', 'Líder de ministério/célula', true),
  ('tesoureiro', 'Acesso financeiro', true),
  ('membro', 'Membro da igreja', true),
  ('visitante', 'Visitante/Novo cadastro', true)
ON CONFLICT (name) DO UPDATE SET 
  description = EXCLUDED.description,
  is_system = true;

-- 4. SEED DATA: PERMISSIONS
-- =====================================================
INSERT INTO public.app_permissions (module, key, name, description)
VALUES 
  ('financeiro', 'financeiro.view', 'Visualizar Financeiro', 'Pode ver dashboards e relatórios financeiros'),
  ('financeiro', 'financeiro.edit', 'Editar Financeiro', 'Pode lançar transações e editar dados financeiros'),
  ('financeiro', 'financeiro.approve', 'Aprovar Financeiro', 'Pode aprovar reembolsos e transações'),
  ('gabinete', 'gabinete.view', 'Visualizar Gabinete', 'Pode ver lista de atendimentos'),
  ('gabinete', 'gabinete.admin', 'Administrar Gabinete', 'Acesso total ao gabinete pastoral'),
  ('ministerio', 'ministerio.view', 'Visualizar Ministérios', 'Pode ver escalas e times'),
  ('ministerio', 'ministerio.edit', 'Editar Ministérios', 'Pode gerenciar escalas e membros de times'),
  ('pessoas', 'pessoas.view', 'Visualizar Pessoas', 'Pode ver lista de pessoas'),
  ('pessoas', 'pessoas.edit', 'Editar Pessoas', 'Pode editar cadastros de pessoas'),
  ('configuracoes', 'configuracoes.view', 'Visualizar Configurações', 'Pode ver configurações do sistema'),
  ('configuracoes', 'configuracoes.edit', 'Editar Configurações', 'Pode alterar configurações do sistema'),
  ('kids', 'kids.view', 'Visualizar Kids', 'Pode ver módulo kids'),
  ('kids', 'kids.checkin', 'Check-in Kids', 'Pode fazer check-in de crianças'),
  ('ensino', 'ensino.view', 'Visualizar Ensino', 'Pode ver cursos e aulas'),
  ('ensino', 'ensino.admin', 'Administrar Ensino', 'Pode gerenciar jornadas e cursos')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  module = EXCLUDED.module;

-- 5. SEED DATA: VÍNCULOS ROLE <-> PERMISSION
-- =====================================================
DO $$
DECLARE
  v_role_id bigint;
  v_perm_id integer;
BEGIN
  -- TESOUREIRO
  SELECT id INTO v_role_id FROM public.app_roles WHERE name = 'tesoureiro';
  IF v_role_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'financeiro.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'financeiro.edit';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'financeiro.approve';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
  END IF;

  -- PASTOR
  SELECT id INTO v_role_id FROM public.app_roles WHERE name = 'pastor';
  IF v_role_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'gabinete.admin';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'gabinete.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'pessoas.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'pessoas.edit';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
  END IF;

  -- LIDER
  SELECT id INTO v_role_id FROM public.app_roles WHERE name = 'lider';
  IF v_role_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'ministerio.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'ministerio.edit';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'pessoas.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'kids.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'kids.checkin';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
  END IF;

  -- MEMBRO
  SELECT id INTO v_role_id FROM public.app_roles WHERE name = 'membro';
  IF v_role_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'ministerio.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'ensino.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
  END IF;

  -- VISITANTE
  SELECT id INTO v_role_id FROM public.app_roles WHERE name = 'visitante';
  IF v_role_id IS NOT NULL THEN
    SELECT id INTO v_perm_id FROM public.app_permissions WHERE key = 'ensino.view';
    IF v_perm_id IS NOT NULL THEN INSERT INTO public.role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING; END IF;
  END IF;
END $$;

-- 6. TRIGGER: Atribuir role 'visitante' automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id
  ) AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'visitante'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assign_default_role ON public.profiles;

CREATE TRIGGER trigger_assign_default_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role();

COMMENT ON FUNCTION public.assign_default_role IS 'Atribui automaticamente a role visitante para novos usuários que não possuem nenhuma role.';
