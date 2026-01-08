-- Tabela de mapeamento dinâmico: Forma Pagamento → Conta
CREATE TABLE IF NOT EXISTS forma_pagamento_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forma_pagamento_id UUID NOT NULL REFERENCES formas_pagamento(id) ON DELETE CASCADE,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais(id) ON DELETE SET NULL,
  prioridade INTEGER DEFAULT 1,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(forma_pagamento_id, conta_id, igreja_id, filial_id)
);

-- Comentário na tabela
COMMENT ON TABLE forma_pagamento_contas IS 'Mapeamento dinâmico entre formas de pagamento e contas financeiras, com suporte a múltiplas contas e prioridades por filial';
COMMENT ON COLUMN forma_pagamento_contas.prioridade IS 'Se forma tem 2+ contas, qual preferência?';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_forma_conta_forma ON forma_pagamento_contas(forma_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_forma_conta_conta ON forma_pagamento_contas(conta_id);
CREATE INDEX IF NOT EXISTS idx_forma_conta_igreja ON forma_pagamento_contas(igreja_id);
CREATE INDEX IF NOT EXISTS idx_forma_conta_filial ON forma_pagamento_contas(filial_id);

-- RLS (Row Level Security)
ALTER TABLE forma_pagamento_contas ENABLE ROW LEVEL SECURITY;

-- Política: Usuários veem mapeamentos de sua própria igreja
CREATE POLICY "Ver mapeamentos da própria igreja"
ON forma_pagamento_contas FOR SELECT
USING (
  public.has_filial_access(igreja_id, filial_id)
);

-- Política: Admin edita mapeamentos
CREATE POLICY "Admin edita mapeamentos"
ON forma_pagamento_contas FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'tesoureiro'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'tesoureiro'::app_role)
);

-- Adicionar colunas em formas_pagamento para taxa e status
ALTER TABLE formas_pagamento
ADD COLUMN IF NOT EXISTS taxa_administrativa DECIMAL(5,2) DEFAULT 0;

COMMENT ON COLUMN formas_pagamento.taxa_administrativa IS 'Percentual de taxa (ex: 3.50)';

ALTER TABLE formas_pagamento
ADD COLUMN IF NOT EXISTS taxa_administrativa_fixa DECIMAL(10,2) DEFAULT NULL;

COMMENT ON COLUMN formas_pagamento.taxa_administrativa_fixa IS 'Taxa em valor fixo (ex: R$ 1.50)';

ALTER TABLE formas_pagamento
ADD COLUMN IF NOT EXISTS gera_pago BOOLEAN DEFAULT false;

COMMENT ON COLUMN formas_pagamento.gera_pago IS 'Dinheiro/PIX=true (pago imediato), Cartão=false (pendente conciliação)';

-- Adicionar campos de auditoria em notifications para rejeição
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;