-- =============================================
-- MIGRATION: Adicionar classificação de pedidos de oração
-- OBJETIVO: Distinguir pedidos BROADCAST (públicos) de PESSOAL (individuais)
-- =============================================

-- 1. Adicionar coluna classificacao
ALTER TABLE public.pedidos_oracao 
ADD COLUMN IF NOT EXISTS classificacao text DEFAULT 'PESSOAL';

-- 2. Adicionar constraint de validação
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_classificacao'
  ) THEN
    ALTER TABLE public.pedidos_oracao 
    ADD CONSTRAINT check_classificacao 
    CHECK (classificacao IN ('BROADCAST', 'PESSOAL'));
  END IF;
END $$;

-- 3. Index para performance em queries filtradas por classificação
CREATE INDEX IF NOT EXISTS idx_pedidos_classificacao ON public.pedidos_oracao(classificacao);