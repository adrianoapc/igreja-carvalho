-- =============================================
-- MIGRATION: Tornar time_id nullable na tabela escalas
-- OBJETIVO: Permitir escalas sem vínculo a time (ex: Relógio de Oração)
-- =============================================

-- 1. REMOVER CONSTRAINT NOT NULL de time_id
ALTER TABLE public.escalas
ALTER COLUMN time_id DROP NOT NULL;

-- 2. COMENTÁRIO PARA DOCUMENTAÇÃO
COMMENT ON COLUMN public.escalas.time_id IS 'Time/ministério associado à escala. Nullable para permitir turnos individuais (ex: Relógio de Oração)';