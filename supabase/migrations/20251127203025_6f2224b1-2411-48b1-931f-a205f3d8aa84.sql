-- Remover a view com SECURITY DEFINER e recriar como view normal
DROP VIEW IF EXISTS public.active_banners;

-- Recriar a view sem SECURITY DEFINER (será uma view normal)
CREATE VIEW public.active_banners AS
SELECT *
FROM public.banners
WHERE public.is_banner_active(active, scheduled_at, expires_at);

-- Corrigir função para ter search_path
CREATE OR REPLACE FUNCTION public.is_banner_active(
  p_active BOOLEAN,
  p_scheduled_at TIMESTAMP WITH TIME ZONE,
  p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- Se não está marcado como ativo, retorna false
  IF NOT p_active THEN
    RETURN false;
  END IF;
  
  -- Se tem data de início agendada e ainda não chegou, retorna false
  IF p_scheduled_at IS NOT NULL AND p_scheduled_at > now() THEN
    RETURN false;
  END IF;
  
  -- Se tem data de expiração e já passou, retorna false
  IF p_expires_at IS NOT NULL AND p_expires_at < now() THEN
    RETURN false;
  END IF;
  
  -- Caso contrário, está ativo
  RETURN true;
END;
$$;