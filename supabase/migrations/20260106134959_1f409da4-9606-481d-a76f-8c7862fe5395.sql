-- Add statement_timeout to prevent silent hangs in get_user_auth_context
CREATE OR REPLACE FUNCTION public.get_user_auth_context(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_igreja_nome text;
  v_filial_nome text;
  v_roles text[];
  v_is_admin boolean := false;
  v_filiais jsonb := '[]'::jsonb;
  v_has_explicit_access boolean := false;
  v_allowed_filial_ids uuid[];
BEGIN
  -- Set statement timeout to prevent infinite hangs (3 seconds)
  PERFORM set_config('statement_timeout', '3000', true);
  
  -- Get profile by user_id
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;
  
  -- Get igreja name
  SELECT nome INTO v_igreja_nome
  FROM igrejas
  WHERE id = v_profile.igreja_id;
  
  -- Get filial name
  SELECT nome INTO v_filial_nome
  FROM filiais
  WHERE id = v_profile.filial_id;
  
  -- Get user roles
  SELECT array_agg(ar.name) INTO v_roles
  FROM user_roles ur
  JOIN app_roles ar ON ar.id = ur.role_id
  WHERE ur.user_id = v_profile.user_id;
  
  v_roles := COALESCE(v_roles, ARRAY[]::text[]);
  
  -- Check if admin
  v_is_admin := 'admin' = ANY(v_roles) OR 'super_admin' = ANY(v_roles);
  
  -- Get all filiais for the igreja
  SELECT jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome))
  INTO v_filiais
  FROM filiais f
  WHERE f.igreja_id = v_profile.igreja_id;
  
  v_filiais := COALESCE(v_filiais, '[]'::jsonb);
  
  -- Check explicit filial access
  SELECT 
    EXISTS(SELECT 1 FROM user_filial_access WHERE user_id = p_user_id),
    array_agg(filial_id)
  INTO v_has_explicit_access, v_allowed_filial_ids
  FROM user_filial_access
  WHERE user_id = p_user_id;
  
  IF NOT v_has_explicit_access THEN
    v_allowed_filial_ids := NULL;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.user_id,
      'igreja_id', v_profile.igreja_id,
      'filial_id', v_profile.filial_id,
      'nome', v_profile.nome,
      'igreja_nome', v_igreja_nome,
      'filial_nome', v_filial_nome
    ),
    'roles', to_jsonb(v_roles),
    'is_admin', v_is_admin,
    'has_explicit_access', v_has_explicit_access,
    'allowed_filial_ids', to_jsonb(v_allowed_filial_ids),
    'filiais', v_filiais
  );
END;
$$;
