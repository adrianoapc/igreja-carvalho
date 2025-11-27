-- Adicionar campos de agendamento na tabela banners
ALTER TABLE public.banners 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Criar função para verificar se banner está no período ativo
CREATE OR REPLACE FUNCTION public.is_banner_active(
  p_active BOOLEAN,
  p_scheduled_at TIMESTAMP WITH TIME ZONE,
  p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
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

-- Criar view para banners ativos (respeitando agendamento)
CREATE OR REPLACE VIEW public.active_banners AS
SELECT *
FROM public.banners
WHERE public.is_banner_active(active, scheduled_at, expires_at);

-- Atualizar política para usar a função
DROP POLICY IF EXISTS "Todos podem ver banners ativos" ON public.banners;

CREATE POLICY "Todos podem ver banners no período"
ON public.banners FOR SELECT
USING (
  -- Admins veem todos
  public.has_role(auth.uid(), 'admin') OR
  -- Outros veem apenas banners ativos no período
  public.is_banner_active(active, scheduled_at, expires_at)
);

-- Criar índices para performance nas queries de data
CREATE INDEX IF NOT EXISTS idx_banners_scheduled_at ON public.banners(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_banners_expires_at ON public.banners(expires_at);
CREATE INDEX IF NOT EXISTS idx_banners_active_dates ON public.banners(active, scheduled_at, expires_at);