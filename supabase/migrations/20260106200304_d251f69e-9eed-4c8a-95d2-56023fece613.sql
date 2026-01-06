-- =====================================================
-- MIGRAÇÃO: Adicionar filial_id e vagas_necessarias em times
-- Data: 2026-01-06
-- =====================================================

-- 1. Adicionar filial_id em times (herda de igreja)
ALTER TABLE public.times
ADD COLUMN IF NOT EXISTS filial_id UUID REFERENCES public.filiais(id);

-- 2. Adicionar vagas_necessarias (quantidade de pessoas necessárias)
ALTER TABLE public.times
ADD COLUMN IF NOT EXISTS vagas_necessarias INTEGER DEFAULT 1;

-- 3. Adicionar dificuldade/nível (fácil, médio, avançado)
ALTER TABLE public.times
ADD COLUMN IF NOT EXISTS dificuldade TEXT DEFAULT 'médio';

-- 4. Criar índices para queries comuns
CREATE INDEX IF NOT EXISTS idx_times_igreja_filial ON public.times(igreja_id, filial_id);
CREATE INDEX IF NOT EXISTS idx_times_ativo ON public.times(ativo);