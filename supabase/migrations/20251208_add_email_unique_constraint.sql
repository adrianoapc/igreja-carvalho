-- Adicionar constraint UNIQUE no email para evitar duplicação
-- Primeiro, verificar e corrigir emails duplicados existentes
DO $$ 
BEGIN
  -- Se houver emails duplicados, manter apenas o primeiro registro
  -- (Ajustar conforme necessidade - este é um exemplo simples)
  DELETE FROM public.profiles 
  WHERE id NOT IN (
    SELECT MIN(id) 
    FROM public.profiles 
    WHERE email IS NOT NULL 
    GROUP BY email
  ) AND email IS NOT NULL;
END $$;

-- Adicionar a constraint UNIQUE no email
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Atualizar a função handle_new_user para verificar email duplicado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  -- Verificar se já existe perfil com este email
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email
  LIMIT 1;
  
  IF existing_profile_id IS NOT NULL THEN
    -- Se já existe perfil com este email, apenas associar o user_id se estiver NULL
    UPDATE public.profiles
    SET user_id = NEW.id,
        nome = COALESCE(nome, NEW.raw_user_meta_data->>'nome', NEW.email)
    WHERE id = existing_profile_id 
      AND user_id IS NULL;
  ELSE
    -- Criar novo perfil
    INSERT INTO public.profiles (user_id, nome, email, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
      NEW.email,
      'visitante'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
