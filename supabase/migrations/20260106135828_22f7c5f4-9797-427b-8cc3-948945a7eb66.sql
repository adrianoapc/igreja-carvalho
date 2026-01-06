-- Corrigir função get_user_auth_context - usar coluna correta user_roles.role
-- A tabela user_roles usa enum direto na coluna 'role', não FK para app_roles

CREATE OR REPLACE FUNCTION public.get_user_auth_context(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_roles TEXT[];
  v_filiais JSONB;
  v_is_admin BOOLEAN := false;
  v_start_time TIMESTAMPTZ;
BEGIN
  -- Timeout de segurança para evitar hang
  PERFORM set_config('statement_timeout', '3000', true);
  
  v_start_time := clock_timestamp();

  -- 1. Buscar perfil do usuário
  SELECT 
    id,
    user_id,
    nome,
    email,
    telefone,
    avatar_url,
    igreja_id,
    filial_id,
    status
  INTO v_profile
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Se não encontrou perfil, retorna erro
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Perfil não encontrado',
      'execution_time_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start_time))
    );
  END IF;

  -- 2. Buscar roles do usuário (coluna role é enum direto, não FK)
  SELECT array_agg(ur.role::text) INTO v_roles
  FROM user_roles ur
  WHERE ur.user_id = p_user_id
    AND (ur.igreja_id = v_profile.igreja_id OR ur.igreja_id IS NULL);

  -- Se não tem roles, array vazio
  IF v_roles IS NULL THEN
    v_roles := ARRAY[]::TEXT[];
  END IF;

  -- Verificar se é admin
  v_is_admin := ('admin' = ANY(v_roles)) OR ('super_admin' = ANY(v_roles));

  -- 3. Buscar filiais que o usuário tem acesso
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'nome', f.nome,
      'is_sede', f.is_sede
    )
  ), '[]'::jsonb) INTO v_filiais
  FROM filiais f
  WHERE f.igreja_id = v_profile.igreja_id
    AND f.ativo = true
    AND (
      v_is_admin = true
      OR f.id = v_profile.filial_id
      OR EXISTS (
        SELECT 1 FROM user_filial_access ufa 
        WHERE ufa.user_id = p_user_id AND ufa.filial_id = f.id
      )
    );

  -- 4. Retornar contexto completo
  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'nome', v_profile.nome,
      'email', v_profile.email,
      'telefone', v_profile.telefone,
      'avatar_url', v_profile.avatar_url,
      'igreja_id', v_profile.igreja_id,
      'filial_id', v_profile.filial_id,
      'status', v_profile.status
    ),
    'roles', to_jsonb(v_roles),
    'is_admin', v_is_admin,
    'filiais', v_filiais,
    'execution_time_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start_time))
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'execution_time_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start_time))
  );
END;
$$;