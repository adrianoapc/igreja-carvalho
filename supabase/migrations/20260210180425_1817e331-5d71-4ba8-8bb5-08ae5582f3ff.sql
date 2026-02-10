
ALTER TABLE public.configuracoes_financeiro
  ADD COLUMN IF NOT EXISTS periodos TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS formas_fisicas_ids UUID[] DEFAULT '{}'::UUID[],
  ADD COLUMN IF NOT EXISTS formas_digitais_ids UUID[] DEFAULT '{}'::UUID[],
  ADD COLUMN IF NOT EXISTS tipos_permitidos_fisico UUID[] DEFAULT '{}'::UUID[],
  ADD COLUMN IF NOT EXISTS tipos_permitidos_digital UUID[] DEFAULT '{}'::UUID[],
  ADD COLUMN IF NOT EXISTS valor_zero_policy TEXT,
  ADD COLUMN IF NOT EXISTS mapeamentos_transferencia JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'configuracoes_financeiro_blind_compare_level_check'
    AND conrelid = 'public.configuracoes_financeiro'::regclass
  ) THEN
    ALTER TABLE public.configuracoes_financeiro
      DROP CONSTRAINT configuracoes_financeiro_blind_compare_level_check;
  END IF;

  ALTER TABLE public.configuracoes_financeiro
    ADD CONSTRAINT configuracoes_financeiro_blind_compare_level_check
    CHECK (blind_compare_level IN ('total', 'tipo', 'forma_pagamento', 'denominacao'));
END $$;
