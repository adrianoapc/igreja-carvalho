-- Limpar emails duplicados (se existirem) - usando cast correto para UUID
DELETE FROM public.profiles 
WHERE id NOT IN (
  SELECT (array_agg(id ORDER BY created_at ASC))[1]
  FROM public.profiles 
  WHERE email IS NOT NULL 
  GROUP BY email
) AND email IS NOT NULL;

-- Adicionar constraint UNIQUE
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- Atualizar função para verificar duplicação
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email
  LIMIT 1;
  
  IF existing_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET user_id = NEW.id,
        nome = COALESCE(nome, NEW.raw_user_meta_data->>'nome', NEW.email)
    WHERE id = existing_profile_id 
      AND user_id IS NULL;
  ELSE
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;