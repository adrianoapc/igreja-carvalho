-- Corrigir função assign_default_role para usar 'basico' em vez de 'visitante'
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
    VALUES (NEW.user_id, 'basico'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assign_default_role IS 'Atribui automaticamente a role basico para novos usuários que não possuem nenhuma role.';