-- Guia prático para configurar financeiro_config e mapeamentos relacionados
-- Execute estes comandos no SQL Editor do Supabase com os IDs corretos.

-- 1) Garantir colunas esperadas em financeiro_config
ALTER TABLE IF EXISTS public.financeiro_config
  ADD COLUMN IF NOT EXISTS periodos text[] NULL,
  ADD COLUMN IF NOT EXISTS formas_fisicas_ids text[] NULL,
  ADD COLUMN IF NOT EXISTS formas_digitais_ids text[] NULL,
  ADD COLUMN IF NOT EXISTS tipos_permitidos_fisico text[] NULL,
  ADD COLUMN IF NOT EXISTS tipos_permitidos_digital text[] NULL,
  ADD COLUMN IF NOT EXISTS valor_zero_policy text NULL;

-- 2) Consultas auxiliares para obter IDs
-- Substitua :IGREJA_UUID e :FILIAL_UUID conforme necessário
-- Formas de pagamento (gera_pago=false: físico | gera_pago=true: digital)
SELECT id, nome, gera_pago
FROM public.formas_pagamento
WHERE igreja_id = ':IGREJA_UUID' AND (filial_id = ':FILIAL_UUID' OR ':FILIAL_UUID' IS NULL);

-- Categorias (tipo=entrada)
SELECT id, nome
FROM public.categorias_financeiras
WHERE tipo = 'entrada' AND igreja_id = ':IGREJA_UUID' AND (filial_id = ':FILIAL_UUID' OR ':FILIAL_UUID' IS NULL);

-- Contas
SELECT id, nome
FROM public.contas
WHERE igreja_id = ':IGREJA_UUID' AND (filial_id = ':FILIAL_UUID' OR ':FILIAL_UUID' IS NULL);

-- 3) Upsert de configuração financeira
-- Preencha os arrays com os IDs obtidos acima.
-- Use NULL para filial se a configuração for global por igreja.
INSERT INTO public.financeiro_config (
  igreja_id,
  filial_id,
  periodos,
  formas_fisicas_ids,
  formas_digitais_ids,
  tipos_permitidos_fisico,
  tipos_permitidos_digital,
  valor_zero_policy
) VALUES (
  ':IGREJA_UUID',
  NULL,
  ARRAY['Manhã','Noite'],
  ARRAY[':ID_FORMA_DINHEIRO',':ID_FORMA_CHEQUE'],
  ARRAY[':ID_FORMA_PIX',':ID_FORMA_CARTAO'],
  ARRAY[':ID_CAT_OFERTA',':ID_CAT_DIZIMO',':ID_CAT_MISSOES'],
  ARRAY[':ID_CAT_OFERTA'],
  'allow-zero-with-confirmation'
)
ON CONFLICT (igreja_id, filial_id)
DO UPDATE SET
  periodos = EXCLUDED.periodos,
  formas_fisicas_ids = EXCLUDED.formas_fisicas_ids,
  formas_digitais_ids = EXCLUDED.formas_digitais_ids,
  tipos_permitidos_fisico = EXCLUDED.tipos_permitidos_fisico,
  tipos_permitidos_digital = EXCLUDED.tipos_permitidos_digital,
  valor_zero_policy = EXCLUDED.valor_zero_policy;

-- 4) Mapeamento de forma -> conta (prioridade menor = preferida)
-- Crie entradas para cada forma com a conta de destino padrão.
INSERT INTO public.forma_pagamento_contas (
  igreja_id,
  filial_id,
  forma_pagamento_id,
  conta_id,
  prioridade
) VALUES
  (':IGREJA_UUID', NULL, ':ID_FORMA_PIX', ':ID_CONTA_PIX', 1),
  (':IGREJA_UUID', NULL, ':ID_FORMA_CARTAO', ':ID_CONTA_CARTAO', 1),
  (':IGREJA_UUID', NULL, ':ID_FORMA_DINHEIRO', ':ID_CONTA_CAIXA', 1);

-- Observações:
-- - Ajuste os IDs nos arrays conforme sua realidade.
-- - Se usar configuração por filial, defina filial_id e repita o upsert por filial.
-- - As telas já aplicam filtros com base em gera_pago e nas listas configuradas.
