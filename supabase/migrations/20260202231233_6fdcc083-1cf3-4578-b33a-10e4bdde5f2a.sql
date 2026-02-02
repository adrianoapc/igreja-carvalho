-- =============================================
-- TRANSFERÊNCIAS ENTRE CONTAS
-- =============================================

-- Tabela principal de transferências
CREATE TABLE public.transferencias_contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_origem_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE RESTRICT,
  conta_destino_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE RESTRICT,
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  data_transferencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_competencia DATE NOT NULL DEFAULT CURRENT_DATE,
  transacao_saida_id UUID REFERENCES public.transacoes_financeiras(id) ON DELETE SET NULL,
  transacao_entrada_id UUID REFERENCES public.transacoes_financeiras(id) ON DELETE SET NULL,
  observacoes TEXT,
  anexo_url TEXT,
  status TEXT NOT NULL DEFAULT 'executada' CHECK (status IN ('executada', 'estornada', 'pendente')),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES public.filiais(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sessao_id UUID REFERENCES public.atendimentos_bot(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Validação: contas diferentes
  CONSTRAINT transferencias_contas_diferentes CHECK (conta_origem_id <> conta_destino_id)
);

-- Índices para performance
CREATE INDEX idx_transferencias_contas_igreja ON public.transferencias_contas(igreja_id);
CREATE INDEX idx_transferencias_contas_filial ON public.transferencias_contas(filial_id);
CREATE INDEX idx_transferencias_contas_data ON public.transferencias_contas(data_transferencia);
CREATE INDEX idx_transferencias_contas_origem ON public.transferencias_contas(conta_origem_id);
CREATE INDEX idx_transferencias_contas_destino ON public.transferencias_contas(conta_destino_id);

-- Trigger para updated_at
CREATE TRIGGER update_transferencias_contas_updated_at
BEFORE UPDATE ON public.transferencias_contas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.transferencias_contas ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Usuarios podem ver transferencias da sua igreja"
ON public.transferencias_contas
FOR SELECT
USING (igreja_id = public.get_jwt_igreja_id());

CREATE POLICY "Usuarios podem criar transferencias na sua igreja"
ON public.transferencias_contas
FOR INSERT
WITH CHECK (igreja_id = public.get_jwt_igreja_id());

CREATE POLICY "Usuarios podem atualizar transferencias da sua igreja"
ON public.transferencias_contas
FOR UPDATE
USING (igreja_id = public.get_jwt_igreja_id());

CREATE POLICY "Usuarios podem deletar transferencias da sua igreja"
ON public.transferencias_contas
FOR DELETE
USING (igreja_id = public.get_jwt_igreja_id());

-- =============================================
-- COLUNA EM TRANSACOES_FINANCEIRAS
-- =============================================

-- Adicionar coluna para identificar transações de transferência
ALTER TABLE public.transacoes_financeiras
ADD COLUMN IF NOT EXISTS transferencia_id UUID REFERENCES public.transferencias_contas(id) ON DELETE SET NULL;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_transacoes_transferencia ON public.transacoes_financeiras(transferencia_id) WHERE transferencia_id IS NOT NULL;

-- Comentários
COMMENT ON TABLE public.transferencias_contas IS 'Transferências entre contas internas - não afetam DRE';
COMMENT ON COLUMN public.transferencias_contas.status IS 'executada: normal, estornada: revertida, pendente: aguardando';
COMMENT ON COLUMN public.transacoes_financeiras.transferencia_id IS 'Referência à transferência que gerou esta transação (se aplicável)';

-- =============================================
-- CONFIGURAÇÃO DE MAPEAMENTOS (em financeiro_config)
-- =============================================

ALTER TABLE public.financeiro_config
ADD COLUMN IF NOT EXISTS mapeamentos_transferencia JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.financeiro_config.mapeamentos_transferencia IS 'Array de mapeamentos automáticos para transferências [{conta_origem_id, conta_destino_id, nome_sugestao}]';