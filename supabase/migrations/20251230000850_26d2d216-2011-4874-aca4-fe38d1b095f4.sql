-- =============================================
-- MIGRATION: Adicionar colunas de turno na tabela escalas
-- OBJETIVO: Suportar slots de horário para Relógio de Oração
-- =============================================

-- 1. ADICIONAR COLUNAS DE TURNO
ALTER TABLE public.escalas
ADD COLUMN IF NOT EXISTS data_hora_inicio TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS data_hora_fim TIMESTAMPTZ;

-- 2. COMENTÁRIOS PARA DOCUMENTAÇÃO
COMMENT ON COLUMN public.escalas.data_hora_inicio IS 'Início do turno/slot do voluntário (ex: 14:00)';
COMMENT ON COLUMN public.escalas.data_hora_fim IS 'Fim do turno/slot do voluntário (ex: 15:00)';

-- 3. ÍNDICE PARA RANGE QUERIES
CREATE INDEX IF NOT EXISTS idx_escalas_periodo 
ON public.escalas(data_hora_inicio, data_hora_fim);

-- 4. ÍNDICE COMPOSTO PARA BUSCAR TURNOS POR EVENTO
CREATE INDEX IF NOT EXISTS idx_escalas_evento_periodo 
ON public.escalas(evento_id, data_hora_inicio, data_hora_fim);