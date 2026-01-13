-- Garantir colunas esperadas em financeiro_config
ALTER TABLE IF EXISTS public.financeiro_config
  ADD COLUMN IF NOT EXISTS periodos text[] NULL,
  ADD COLUMN IF NOT EXISTS formas_fisicas_ids text[] NULL,
  ADD COLUMN IF NOT EXISTS formas_digitais_ids text[] NULL,
  ADD COLUMN IF NOT EXISTS tipos_permitidos_fisico text[] NULL,
  ADD COLUMN IF NOT EXISTS tipos_permitidos_digital text[] NULL,
  ADD COLUMN IF NOT EXISTS valor_zero_policy text NULL;

COMMENT ON COLUMN public.financeiro_config.periodos IS 'Períodos disponíveis para cultos (ex: Manhã, Noite)';
COMMENT ON COLUMN public.financeiro_config.formas_fisicas_ids IS 'IDs das formas de pagamento físicas (dinheiro, cheque)';
COMMENT ON COLUMN public.financeiro_config.formas_digitais_ids IS 'IDs das formas de pagamento digitais (PIX, cartão)';
COMMENT ON COLUMN public.financeiro_config.tipos_permitidos_fisico IS 'IDs das categorias permitidas para contagem física';
COMMENT ON COLUMN public.financeiro_config.tipos_permitidos_digital IS 'IDs das categorias permitidas para entrada digital';
COMMENT ON COLUMN public.financeiro_config.valor_zero_policy IS 'Política para valores zero: allow|block|allow-zero-with-confirmation';