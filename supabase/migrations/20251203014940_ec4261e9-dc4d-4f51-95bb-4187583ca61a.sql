-- Add lider_id column to times_culto table
ALTER TABLE public.times_culto 
ADD COLUMN lider_id uuid REFERENCES public.profiles(id);

-- Create index for better query performance
CREATE INDEX idx_times_culto_lider_id ON public.times_culto(lider_id);

-- Update the get_minha_lista_chamada function to use lider_id
CREATE OR REPLACE FUNCTION public.get_minha_lista_chamada(p_culto_id uuid)
 RETURNS TABLE(pessoa_id uuid, nome text, avatar_url text, nome_grupo text, tipo_grupo text, ja_marcado boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  -- Get the current user_id
  v_user_id := auth.uid();
  
  -- Get the profile_id of the logged-in user
  SELECT id INTO v_profile_id 
  FROM public.profiles 
  WHERE user_id = v_user_id;

  RETURN QUERY
  -- Fetch members from teams where the user is the leader (lider_id)
  SELECT DISTINCT
    mt.pessoa_id,
    p.nome,
    p.avatar_url,
    tc.nome AS nome_grupo,
    'ministerio'::TEXT AS tipo_grupo,
    EXISTS (
      SELECT 1 FROM public.presencas_culto pc 
      WHERE pc.culto_id = p_culto_id 
      AND pc.pessoa_id = mt.pessoa_id
    ) AS ja_marcado
  FROM public.membros_time mt
  INNER JOIN public.times_culto tc ON mt.time_id = tc.id
  INNER JOIN public.profiles p ON mt.pessoa_id = p.id
  WHERE tc.lider_id = v_profile_id
  AND mt.ativo = true
  AND tc.ativo = true
  AND mt.pessoa_id != v_profile_id
  
  UNION ALL
  
  -- Also fetch family members of the leader (simulating family cell)
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
$function$;