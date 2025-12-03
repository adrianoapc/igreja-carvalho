CREATE OR REPLACE FUNCTION public.get_ovelhas_em_risco()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  avatar_url TEXT,
  telefone TEXT,
  tipo_risco TEXT,
  detalhe TEXT,
  gravidade INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  
  -- 1. Risco por Ausência (Quem não vem há 21 dias)
  SELECT 
    p.id,
    p.nome,
    p.avatar_url,
    p.telefone,
    'ausencia'::TEXT as tipo_risco,
    (EXTRACT(DAY FROM (now() - COALESCE(MAX(pc.created_at), p.created_at)))::TEXT || ' dias ausente') as detalhe,
    CASE WHEN (now() - COALESCE(MAX(pc.created_at), p.created_at)) > INTERVAL '30 days' THEN 2 ELSE 1 END as gravidade
  FROM public.profiles p
  LEFT JOIN public.presencas_culto pc ON pc.pessoa_id = p.id
  WHERE p.status = 'membro'
  GROUP BY p.id, p.nome, p.avatar_url, p.telefone, p.created_at
  HAVING MAX(pc.created_at) < (now() - INTERVAL '21 days') 
     OR (MAX(pc.created_at) IS NULL AND p.created_at < (now() - INTERVAL '21 days'))

  UNION ALL

  -- 2. Risco por Sentimento (Registrou tristeza nos últimos 7 dias)
  SELECT 
    p.id,
    p.nome,
    p.avatar_url,
    p.telefone,
    'sentimento'::TEXT as tipo_risco,
    INITCAP(sm.sentimento::TEXT) as detalhe,
    2 as gravidade
  FROM public.sentimentos_membros sm
  JOIN public.profiles p ON p.id = sm.pessoa_id
  WHERE sm.data_registro > (now() - INTERVAL '7 days')
  AND sm.sentimento IN ('angustiado', 'triste', 'sozinho', 'doente', 'com_pouca_fe', 'com_medo');
END;
$$;