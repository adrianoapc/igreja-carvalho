-- Migration: Fix - Create user using Supabase auth.create_user() function
-- The previous approach tried to INSERT directly into auth.users which won't work
-- This uses the proper Supabase function to create users

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
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_profile_exists boolean;
BEGIN
  -- Verify profile exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_profile_id) INTO v_profile_exists;
  
  IF NOT v_profile_exists THEN
    RETURN QUERY SELECT null::uuid, false, 'Profile não encontrado'::text;
    RETURN;
  END IF;

  -- Check if profile already has a user_id
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id IS NOT NULL) THEN
    RETURN QUERY SELECT null::uuid, false, 'Este perfil já possui uma conta de usuário'::text;
    RETURN;
  END IF;

  -- Use Supabase auth.create_user() function to create the user
  -- This is the proper way to create users in Supabase
  SELECT
    auth.create_user(
      email := p_email,
      password := p_senha_temporaria,
      email_confirm := false
    ).id INTO v_user_id;

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
SET search_path = public, auth
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

  -- Update password using auth.update_user_by_id()
  PERFORM auth.update_user_by_id(v_user_id, jsonb_build_object('password', p_senha_temporaria));

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
