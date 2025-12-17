-- 1. Adicionar colunas de controle em escalas_culto
ALTER TABLE public.escalas_culto 
ADD COLUMN IF NOT EXISTS checkin_realizado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_confirmacao TIMESTAMP WITH TIME ZONE;

-- 2. Criar constraint para validar status_confirmacao (incluindo troca_solicitada)
-- Primeiro remover constraint existente se houver, depois adicionar nova
DO $$ 
BEGIN
  -- Atualizar valores existentes que não estão no novo conjunto permitido
  UPDATE public.escalas_culto 
  SET status_confirmacao = 'pendente' 
  WHERE status_confirmacao IS NULL OR status_confirmacao NOT IN ('pendente', 'confirmado', 'recusado', 'troca_solicitada');
  
  -- Tentar adicionar constraint (ignora se já existir com mesmo nome)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'escalas_culto_status_check'
  ) THEN
    ALTER TABLE public.escalas_culto 
    ADD CONSTRAINT escalas_culto_status_check 
    CHECK (status_confirmacao IN ('pendente', 'confirmado', 'recusado', 'troca_solicitada'));
  END IF;
END $$;

-- 3. Função de Detecção de Conflito adaptada ao nosso schema
CREATE OR REPLACE FUNCTION public.check_voluntario_conflito(
  p_voluntario_id UUID, 
  p_data_inicio TIMESTAMP WITH TIME ZONE, 
  p_duracao_minutos INT DEFAULT 120
)
RETURNS TABLE (
  conflito_detectado BOOLEAN,
  time_nome TEXT,
  culto_titulo TEXT,
  culto_data TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true::BOOLEAN as conflito_detectado,
    tc.nome as time_nome,
    c.titulo as culto_titulo,
    c.data_culto as culto_data
  FROM public.escalas_culto ec
  JOIN public.cultos c ON ec.culto_id = c.id
  JOIN public.times_culto tc ON ec.time_id = tc.id
  WHERE ec.pessoa_id = p_voluntario_id
  AND ec.status_confirmacao IN ('pendente', 'confirmado')
  -- Lógica de sobreposição de horário usando OVERLAPS
  AND (
    c.data_culto, 
    c.data_culto + (INTERVAL '1 minute' * COALESCE(c.duracao_minutos, p_duracao_minutos))
  ) OVERLAPS (
    p_data_inicio, 
    p_data_inicio + (INTERVAL '1 minute' * p_duracao_minutos)
  );
END;
$$;

-- 4. Comentários para documentação
COMMENT ON COLUMN public.escalas_culto.checkin_realizado IS 'Indica se o voluntário fez check-in no dia do culto';
COMMENT ON COLUMN public.escalas_culto.data_confirmacao IS 'Data/hora em que o voluntário confirmou participação';
COMMENT ON FUNCTION public.check_voluntario_conflito IS 'Verifica se um voluntário tem conflito de horário com outras escalas';