-- Adicionar campos de controle de visitas na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS numero_visitas integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS data_ultima_visita timestamp with time zone NULL;

-- Atualizar registros existentes para ter numero_visitas = 1 onde for NULL
UPDATE public.profiles
SET numero_visitas = 1
WHERE numero_visitas IS NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.numero_visitas IS 'Contador de quantas vezes o visitante compareceu';
COMMENT ON COLUMN public.profiles.data_ultima_visita IS 'Data da última visita registrada do visitante';