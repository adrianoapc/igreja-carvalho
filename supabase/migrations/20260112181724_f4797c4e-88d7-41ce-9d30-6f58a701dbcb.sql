-- Ajustes em transacoes_financeiras para rastreabilidade
-- Adicionar pessoa_id (membro) e origem_registro (manual|api)
ALTER TABLE public.transacoes_financeiras
ADD COLUMN IF NOT EXISTS pessoa_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS origem_registro TEXT NOT NULL DEFAULT 'manual' CHECK (origem_registro IN ('manual','api'));

CREATE INDEX IF NOT EXISTS idx_transacoes_pessoa ON public.transacoes_financeiras(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_origem ON public.transacoes_financeiras(origem_registro);

COMMENT ON COLUMN public.transacoes_financeiras.pessoa_id IS 'Identificação do membro (quando aplicável)';
COMMENT ON COLUMN public.transacoes_financeiras.origem_registro IS 'Origem do registro (manual ou api).';