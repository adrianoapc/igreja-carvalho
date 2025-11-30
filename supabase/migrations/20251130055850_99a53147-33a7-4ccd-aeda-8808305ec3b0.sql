-- Adicionar campos de agendamento nas mídias
ALTER TABLE public.midias
  ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.midias.scheduled_at IS 'Data/hora programada para publicação da mídia';
COMMENT ON COLUMN public.midias.expires_at IS 'Data/hora de expiração/remoção automática da mídia';

-- Criar função para verificar se mídia está ativa (considerando datas)
CREATE OR REPLACE FUNCTION public.is_midia_active(
  p_ativo BOOLEAN,
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
  IF NOT p_ativo THEN
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