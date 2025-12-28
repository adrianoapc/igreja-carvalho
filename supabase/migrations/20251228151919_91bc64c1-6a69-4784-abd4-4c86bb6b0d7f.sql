-- =====================================================
-- MIGRAÇÃO: Refatoração de Cultos para Hub de Eventos
-- Versão: 1.1 (Correção DROP FUNCTION)
-- =====================================================

-- =====================================================
-- 11. ATUALIZAR FUNÇÃO check_voluntario_conflito
-- (Deve dropar primeiro por mudança de tipo de retorno)
-- =====================================================
DROP FUNCTION IF EXISTS public.check_voluntario_conflito(uuid, timestamp with time zone, integer);

CREATE FUNCTION public.check_voluntario_conflito(
  p_voluntario_id uuid, 
  p_data_inicio timestamp with time zone, 
  p_duracao_minutos integer DEFAULT 120
)
RETURNS TABLE(
  conflito_detectado boolean, 
  time_nome text, 
  evento_titulo text, 
  evento_data timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    true::BOOLEAN as conflito_detectado,
    tc.nome as time_nome,
    e.titulo as evento_titulo,
    e.data_culto as evento_data
  FROM public.escalas_culto ec
  JOIN public.eventos e ON ec.evento_id = e.id
  JOIN public.times_culto tc ON ec.time_id = tc.id
  WHERE ec.pessoa_id = p_voluntario_id
  AND ec.status_confirmacao IN ('pendente', 'confirmado')
  AND (
    e.data_culto, 
    e.data_culto + (INTERVAL '1 minute' * COALESCE(e.duracao_minutos, p_duracao_minutos))
  ) OVERLAPS (
    p_data_inicio, 
    p_data_inicio + (INTERVAL '1 minute' * p_duracao_minutos)
  );
END;
$function$;