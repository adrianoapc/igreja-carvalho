-- Criar função get_ovelhas_em_risco para identificar membros em risco pastoral
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
DECLARE
  current_igreja_id UUID;
BEGIN
  -- Obter igreja_id do usuário atual
  SELECT get_current_user_igreja_id() INTO current_igreja_id;

  IF current_igreja_id IS NULL THEN
    RETURN;
  END IF;

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
  LEFT JOIN public.checkins pc ON pc.pessoa_id = p.id
  WHERE p.status = 'membro'
    AND p.igreja_id = current_igreja_id
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
    AND sm.igreja_id = current_igreja_id
    AND p.igreja_id = current_igreja_id
    AND sm.sentimento IN ('angustiado', 'triste', 'sozinho', 'doente', 'com_pouca_fe')

  ORDER BY gravidade DESC, nome;
END;
$$;

COMMENT ON FUNCTION public.get_ovelhas_em_risco IS 'Retorna membros em risco pastoral: ausentes há mais de 21 dias ou com sentimentos negativos recentes';