ALTER TABLE public.configuracoes_financeiro
ADD COLUMN controla_dizimistas BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.configuracoes_financeiro.controla_dizimistas IS 'Se true, exibe o campo para associar um dizimista/ofertante à transação.';