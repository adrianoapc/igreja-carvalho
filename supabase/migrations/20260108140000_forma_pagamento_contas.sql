-- Tabela de mapeamento dinâmico: Forma Pagamento → Conta
CREATE TABLE IF NOT EXISTS forma_pagamento_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forma_pagamento_id UUID NOT NULL REFERENCES formas_pagamento(id) ON DELETE CASCADE,
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais(id) ON DELETE SET NULL,
  prioridade INTEGER DEFAULT 1 COMMENT 'Se forma tem 2+ contas, qual preferência?',
  criado_em TIMESTAMP DEFAULT now(),
  
  UNIQUE(forma_pagamento_id, conta_id, igreja_id, filial_id)
);

-- Índices para performance
CREATE INDEX idx_forma_conta_forma ON forma_pagamento_contas(forma_pagamento_id);
CREATE INDEX idx_forma_conta_conta ON forma_pagamento_contas(conta_id);
CREATE INDEX idx_forma_conta_igreja ON forma_pagamento_contas(igreja_id);
CREATE INDEX idx_forma_conta_filial ON forma_pagamento_contas(filial_id);

-- RLS (Row Level Security)
ALTER TABLE forma_pagamento_contas ENABLE ROW LEVEL SECURITY;

-- Política: Usuários veem mapeamentos de sua própria igreja
CREATE POLICY "Ver mapeamentos da própria igreja"
  ON forma_pagamento_contas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.igreja_id = forma_pagamento_contas.igreja_id
    )
  );

-- Política: Apenas admin edita/cria mapeamentos
CREATE POLICY "Admin edita mapeamentos"
  ON forma_pagamento_contas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
        AND user_roles.igreja_id = forma_pagamento_contas.igreja_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
        AND user_roles.igreja_id = forma_pagamento_contas.igreja_id
    )
  );

-- Adicionar colunas em formas_pagamento para taxa e status
ALTER TABLE formas_pagamento
ADD COLUMN IF NOT EXISTS taxa_administrativa DECIMAL(5,2) DEFAULT 0 COMMENT 'Percentual de taxa (ex: 3.50)';

ALTER TABLE formas_pagamento
ADD COLUMN IF NOT EXISTS taxa_administrativa_fixa DECIMAL(10,2) DEFAULT NULL COMMENT 'Taxa em valor fixo (ex: R$ 1.50)';

ALTER TABLE formas_pagamento
ADD COLUMN IF NOT EXISTS gera_pago BOOLEAN DEFAULT false COMMENT 'Dinheiro/PIX=true (pago), Cartão=false (pendente)';

-- Inserir dados de migração automática (opcional, comentado para manual)
-- INSERT INTO forma_pagamento_contas (forma_pagamento_id, conta_id, igreja_id, prioridade)
-- SELECT 
--   f.id,
--   c.id,
--   f.igreja_id,
--   1
-- FROM formas_pagamento f
-- JOIN contas c ON c.igreja_id = f.igreja_id
-- WHERE f.ativo = true
--   AND (
--     (f.nome ILIKE '%dinheiro%' AND c.nome ILIKE '%oferta%')
--     OR (f.nome ILIKE '%pix%' AND c.nome ILIKE '%oferta%')
--     OR (f.nome ILIKE '%débito%' AND c.nome ILIKE '%santander%')
--     OR (f.nome ILIKE '%crédito%' AND c.nome ILIKE '%credito%')
--   )
-- ON CONFLICT (forma_pagamento_id, conta_id, igreja_id, filial_id)
-- DO NOTHING;

-- Atualizar taxas e status padrão
-- UPDATE formas_pagamento SET
--   taxa_administrativa = 3.50,
--   gera_pago = false
-- WHERE (nome ILIKE '%crédito%' OR nome ILIKE '%credito%') AND taxa_administrativa = 0;
--
-- UPDATE formas_pagamento SET
--   taxa_administrativa = 2.00,
--   gera_pago = false
-- WHERE (nome ILIKE '%débito%' OR nome ILIKE '%debito%') AND taxa_administrativa = 0;
--
-- UPDATE formas_pagamento SET
--   gera_pago = true
-- WHERE (nome ILIKE '%dinheiro%' OR nome ILIKE '%pix%') AND gera_pago = false;

-- Adicionar campos de auditoria em notifications para rejeição
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON TABLE forma_pagamento_contas IS 'Mapeamento dinâmico entre formas de pagamento e contas financeiras, com suporte a múltiplas contas e prioridades por filial';
