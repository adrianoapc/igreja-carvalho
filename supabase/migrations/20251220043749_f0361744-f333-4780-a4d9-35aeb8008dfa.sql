-- Adicionar campo historico_evolucao para notas de evolução
ALTER TABLE public.atendimentos_pastorais
ADD COLUMN IF NOT EXISTS historico_evolucao JSONB DEFAULT '[]'::jsonb;