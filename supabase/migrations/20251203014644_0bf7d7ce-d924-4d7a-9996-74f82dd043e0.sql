-- Criar função RPC para buscar lista de chamada do líder
CREATE OR REPLACE FUNCTION public.get_minha_lista_chamada(p_culto_id UUID)
RETURNS TABLE (
  pessoa_id UUID,
  nome TEXT,
  avatar_url TEXT,
  nome_grupo TEXT,
  tipo_grupo TEXT,
  ja_marcado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  -- Pegar o user_id atual
  v_user_id := auth.uid();
  
  -- Pegar o profile_id do usuário logado
  SELECT id INTO v_profile_id 
  FROM public.profiles 
  WHERE user_id = v_user_id;

  RETURN QUERY
  -- Buscar membros dos times que o líder faz parte (como líder)
  SELECT DISTINCT
    mt.pessoa_id,
    p.nome,
    p.avatar_url,
    ct.nome AS nome_grupo,
    'ministerio'::TEXT AS tipo_grupo,
    EXISTS (
      SELECT 1 FROM public.presencas_culto pc 
      WHERE pc.culto_id = p_culto_id 
      AND pc.pessoa_id = mt.pessoa_id
    ) AS ja_marcado
  FROM public.membros_time mt
  INNER JOIN public.posicoes_time pt ON mt.time_id = pt.time_id
  INNER JOIN public.categorias_times ct ON pt.time_id = ct.id OR mt.time_id IN (
    SELECT pt2.time_id FROM public.posicoes_time pt2
  )
  INNER JOIN public.profiles p ON mt.pessoa_id = p.id
  WHERE mt.ativo = true
  AND mt.pessoa_id != v_profile_id
  
  UNION ALL
  
  -- Também buscar familiares do líder (simulando célula familiar)
  SELECT DISTINCT
    f.familiar_id AS pessoa_id,
    COALESCE(pf.nome, f.nome_familiar) AS nome,
    pf.avatar_url,
    'Família'::TEXT AS nome_grupo,
    'celula'::TEXT AS tipo_grupo,
    EXISTS (
      SELECT 1 FROM public.presencas_culto pc 
      WHERE pc.culto_id = p_culto_id 
      AND pc.pessoa_id = f.familiar_id
    ) AS ja_marcado
  FROM public.familias f
  LEFT JOIN public.profiles pf ON f.familiar_id = pf.id
  WHERE f.pessoa_id = v_profile_id
  AND f.familiar_id IS NOT NULL
  
  ORDER BY nome_grupo, nome;
END;
$$;