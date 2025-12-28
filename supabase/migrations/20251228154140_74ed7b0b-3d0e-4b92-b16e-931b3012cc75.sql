-- =====================================================
-- FIX: Security Definer View - Recriar view com SECURITY INVOKER
-- =====================================================

-- Recriar VIEW view_kids_checkins_ativos com SECURITY INVOKER (padrão seguro)
DROP VIEW IF EXISTS public.view_kids_checkins_ativos;

CREATE VIEW public.view_kids_checkins_ativos 
WITH (security_invoker = true) AS
SELECT 
  kc.id,
  kc.crianca_id,
  c.nome AS crianca_nome,
  c.avatar_url AS crianca_avatar,
  c.data_nascimento AS crianca_data_nascimento,
  kc.responsavel_id,
  r.nome AS responsavel_nome,
  r.telefone AS responsavel_telefone,
  kc.checkin_at,
  kc.checkin_por,
  cp.nome AS checkin_por_nome,
  kc.evento_id,
  kc.observacoes
FROM public.kids_checkins kc
JOIN public.profiles c ON c.id = kc.crianca_id
JOIN public.profiles r ON r.id = kc.responsavel_id
LEFT JOIN public.profiles cp ON cp.id = kc.checkin_por
WHERE kc.checkout_at IS NULL;

COMMENT ON VIEW public.view_kids_checkins_ativos IS 'View de check-ins ativos do Kids Ministry (crianças ainda não retiradas)';