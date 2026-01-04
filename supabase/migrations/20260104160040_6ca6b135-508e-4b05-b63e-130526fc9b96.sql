-- Recriar view sem SECURITY DEFINER (usar INVOKER padrão)
-- A segurança é garantida pelo próprio SELECT que mascara os dados
DROP VIEW IF EXISTS public.webhooks_safe;

CREATE VIEW public.webhooks_safe 
WITH (security_invoker = on)
AS
SELECT 
  id,
  igreja_id,
  filial_id,
  tipo,
  url,
  enabled,
  CASE 
    WHEN secret_encrypted IS NOT NULL THEN '••••••••' || COALESCE(secret_hint, '')
    WHEN secret IS NOT NULL THEN '••••••••' || RIGHT(secret, 4)
    ELSE NULL 
  END as secret_masked,
  CASE 
    WHEN secret_encrypted IS NOT NULL OR secret IS NOT NULL THEN true
    ELSE false 
  END as has_secret,
  created_at,
  updated_at
FROM public.webhooks;

-- Conceder permissões
GRANT SELECT ON public.webhooks_safe TO authenticated;

COMMENT ON VIEW public.webhooks_safe IS 'View segura para webhooks - secrets são mascarados. Usa RLS da tabela base.';