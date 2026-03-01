
-- RPC: Retorna o nível de acesso do usuário para um time específico
-- Retorna: 'admin' | 'lider' | 'sublider' | 'membro' | null
CREATE OR REPLACE FUNCTION public.get_user_time_role(
  p_pessoa_id UUID,
  p_time_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- 1. Verificar se é admin/tecnico (bypass global)
  SELECT EXISTS(
    SELECT 1 FROM user_app_roles uar
    JOIN app_roles ar ON ar.id = uar.role_id
    WHERE uar.user_id = (SELECT user_id FROM profiles WHERE id = p_pessoa_id LIMIT 1)
    AND ar.name IN ('admin', 'tecnico')
  ) INTO v_is_admin;

  IF v_is_admin THEN RETURN 'admin'; END IF;

  -- 2. Verificar se é líder do time
  IF EXISTS(SELECT 1 FROM times WHERE id = p_time_id AND lider_id = p_pessoa_id) THEN
    RETURN 'lider';
  END IF;

  -- 3. Verificar se é sublíder
  IF EXISTS(SELECT 1 FROM times WHERE id = p_time_id AND sublider_id = p_pessoa_id) THEN
    RETURN 'sublider';
  END IF;

  -- 4. Verificar se é membro ativo
  IF EXISTS(SELECT 1 FROM membros_time WHERE time_id = p_time_id AND pessoa_id = p_pessoa_id AND ativo = true) THEN
    RETURN 'membro';
  END IF;

  -- 5. Sem vínculo
  RETURN NULL;
END;
$$;

-- RPC: Retorna todos os times que o usuário tem vínculo (para filtrar dropdowns)
CREATE OR REPLACE FUNCTION public.get_user_times(p_pessoa_id UUID)
RETURNS TABLE(time_id UUID, role TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar bypass admin/tecnico
  SELECT EXISTS(
    SELECT 1 FROM user_app_roles uar
    JOIN app_roles ar ON ar.id = uar.role_id
    WHERE uar.user_id = (SELECT user_id FROM profiles WHERE id = p_pessoa_id LIMIT 1)
    AND ar.name IN ('admin', 'tecnico')
  ) INTO v_is_admin;

  IF v_is_admin THEN
    -- Admin vê todos os times
    RETURN QUERY SELECT t.id AS time_id, 'admin'::TEXT AS role FROM times t WHERE t.ativo = true;
    RETURN;
  END IF;

  -- Times onde é líder
  RETURN QUERY SELECT t.id, 'lider'::TEXT FROM times t WHERE t.lider_id = p_pessoa_id AND t.ativo = true;

  -- Times onde é sublíder (sem duplicar)
  RETURN QUERY SELECT t.id, 'sublider'::TEXT FROM times t
    WHERE t.sublider_id = p_pessoa_id AND t.ativo = true
    AND t.lider_id IS DISTINCT FROM p_pessoa_id;

  -- Times onde é membro ativo (sem duplicar)
  RETURN QUERY SELECT mt.time_id, 'membro'::TEXT FROM membros_time mt
    JOIN times t ON t.id = mt.time_id
    WHERE mt.pessoa_id = p_pessoa_id AND mt.ativo = true AND t.ativo = true
    AND NOT EXISTS(SELECT 1 FROM times t2 WHERE t2.id = mt.time_id AND (t2.lider_id = p_pessoa_id OR t2.sublider_id = p_pessoa_id));

  RETURN;
END;
$$;
