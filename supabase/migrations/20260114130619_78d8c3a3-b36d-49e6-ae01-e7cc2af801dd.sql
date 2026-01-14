-- Migration: Create RPC functions for user creation and password reset

-- Function to create a user account for a member
CREATE OR REPLACE FUNCTION public.criar_usuario_membro(
  p_profile_id uuid,
  p_email text,
  p_senha_temporaria text
)
RETURNS TABLE (
  user_id uuid,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Create user in auth.users using auth admin API
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_senha_temporaria, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated'
  )
  RETURNING auth.users.id INTO v_user_id;

  -- Update profile with user_id and mark for password change
  UPDATE public.profiles
  SET 
    user_id = v_user_id,
    deve_trocar_senha = true,
    updated_at = now()
  WHERE id = p_profile_id;

  RETURN QUERY SELECT v_user_id, true, 'Usuário criado com sucesso'::text;
EXCEPTION WHEN others THEN
  RETURN QUERY SELECT null::uuid, false, SQLERRM::text;
END;
$$;

-- Function to reset user password
CREATE OR REPLACE FUNCTION public.resetar_senha_usuario_membro(
  p_profile_id uuid,
  p_senha_temporaria text
)
RETURNS TABLE (
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user_id from profile
  SELECT p.user_id INTO v_user_id FROM public.profiles p WHERE p.id = p_profile_id;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não encontrado'::text;
    RETURN;
  END IF;

  -- Update password in auth.users
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_senha_temporaria, gen_salt('bf')),
    updated_at = now()
  WHERE id = v_user_id;

  -- Mark profile for password change
  UPDATE public.profiles
  SET 
    deve_trocar_senha = true,
    updated_at = now()
  WHERE id = p_profile_id;

  RETURN QUERY SELECT true, 'Senha resetada com sucesso'::text;
EXCEPTION WHEN others THEN
  RETURN QUERY SELECT false, SQLERRM::text;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.criar_usuario_membro(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resetar_senha_usuario_membro(uuid, text) TO authenticated;