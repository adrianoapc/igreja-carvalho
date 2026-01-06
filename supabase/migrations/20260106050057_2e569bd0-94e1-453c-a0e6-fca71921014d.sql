-- Função RPC que agrega todos os dados de contexto do usuário em uma única query
-- Substitui 5-7 queries individuais por 1 query otimizada

CREATE OR REPLACE FUNCTION public.get_user_auth_context(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_profile record;
  v_roles text[];
  v_allowed_filial_ids uuid[];
  v_filiais jsonb;
  v_igreja_nome text;
  v_filial_nome text;
  v_has_explicit_access boolean;
BEGIN
  -- 1. Buscar profile do usuário
  SELECT id, igreja_id, filial_id, full_name
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;
  
  -- 2. Buscar roles do usuário na igreja
  SELECT array_agg(role)
  INTO v_roles
  FROM user_roles
  WHERE user_id = p_user_id
    AND (igreja_id = v_profile.igreja_id OR igreja_id IS NULL);
  
  v_roles := COALESCE(v_roles, ARRAY[]::text[]);
  
  -- 3. Verificar se tem acesso explícito (user_filial_access)
  SELECT EXISTS(
    SELECT 1 FROM user_filial_access 
    WHERE user_id = p_user_id
  ) INTO v_has_explicit_access;
  
  -- 4. Buscar filial_ids permitidos (se houver restrição explícita)
  IF v_has_explicit_access THEN
    SELECT array_agg(filial_id)
    INTO v_allowed_filial_ids
    FROM user_filial_access
    WHERE user_id = p_user_id;
  ELSE
    v_allowed_filial_ids := NULL; -- NULL = sem restrição
  END IF;
  
  -- 5. Buscar nome da igreja
  SELECT nome INTO v_igreja_nome
  FROM igrejas
  WHERE id = v_profile.igreja_id;
  
  -- 6. Buscar nome da filial atual
  SELECT nome INTO v_filial_nome
  FROM filiais
  WHERE id = v_profile.filial_id;
  
  -- 7. Buscar todas as filiais da igreja
  SELECT jsonb_agg(
    jsonb_build_object('id', id, 'nome', nome)
    ORDER BY nome
  )
  INTO v_filiais
  FROM filiais
  WHERE igreja_id = v_profile.igreja_id;
  
  v_filiais := COALESCE(v_filiais, '[]'::jsonb);
  
  -- 8. Montar resultado final
  v_result := jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'igreja_id', v_profile.igreja_id,
      'filial_id', v_profile.filial_id,
      'full_name', v_profile.full_name,
      'igreja_nome', v_igreja_nome,
      'filial_nome', v_filial_nome
    ),
    'roles', to_jsonb(v_roles),
    'has_explicit_access', v_has_explicit_access,
    'allowed_filial_ids', CASE 
      WHEN v_allowed_filial_ids IS NULL THEN NULL
      ELSE to_jsonb(v_allowed_filial_ids)
    END,
    'filiais', v_filiais,
    'is_admin', (
      v_roles && ARRAY['admin', 'super_admin', 'admin_igreja']
    )
  );
  
  RETURN v_result;
END;
$$;

-- Dar permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION public.get_user_auth_context(uuid) TO authenticated;