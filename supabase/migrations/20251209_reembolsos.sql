-- Migration: Sistema de Gestão de Reembolsos
-- Descrição: Permite que líderes lancem despesas em lote e tesoureiros aprovem/paguem de uma vez

-- =====================================================
-- 1. CRIAÇÃO DA TABELA solicitacoes_reembolso
-- =====================================================
CREATE TABLE IF NOT EXISTS solicitacoes_reembolso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'pendente', 'aprovado', 'pago', 'rejeitado')),
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  data_pagamento TIMESTAMP WITH TIME ZONE,
  forma_pagamento_preferida TEXT CHECK (forma_pagamento_preferida IN ('pix', 'dinheiro', 'transferencia')),
  dados_bancarios TEXT,
  observacoes TEXT,
  valor_total NUMERIC(10,2) DEFAULT 0,
  comprovante_pagamento_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentários da tabela
COMMENT ON TABLE solicitacoes_reembolso IS 'Solicitações de reembolso agrupadas - cabeçalho do pedido';
COMMENT ON COLUMN solicitacoes_reembolso.solicitante_id IS 'Pessoa que está solicitando o reembolso';
COMMENT ON COLUMN solicitacoes_reembolso.status IS 'rascunho: em edição | pendente: aguardando análise | aprovado: aprovado mas não pago | pago: finalizado | rejeitado: negado';
COMMENT ON COLUMN solicitacoes_reembolso.data_vencimento IS 'Data limite para pagamento do reembolso';
COMMENT ON COLUMN solicitacoes_reembolso.forma_pagamento_preferida IS 'Como o solicitante prefere receber';
COMMENT ON COLUMN solicitacoes_reembolso.dados_bancarios IS 'Chave PIX, conta bancária ou informações para pagamento';
COMMENT ON COLUMN solicitacoes_reembolso.valor_total IS 'Soma automática de todos os itens vinculados';
COMMENT ON COLUMN solicitacoes_reembolso.comprovante_pagamento_url IS 'URL do comprovante de repasse ao solicitante';

-- Índices para performance
CREATE INDEX idx_solicitacoes_reembolso_solicitante ON solicitacoes_reembolso(solicitante_id);
CREATE INDEX idx_solicitacoes_reembolso_status ON solicitacoes_reembolso(status);
CREATE INDEX idx_solicitacoes_reembolso_data ON solicitacoes_reembolso(data_solicitacao);

-- =====================================================
-- 2. ALTERAÇÃO NA TABELA transacoes_financeiras
-- =====================================================
ALTER TABLE transacoes_financeiras 
ADD COLUMN IF NOT EXISTS solicitacao_reembolso_id UUID REFERENCES solicitacoes_reembolso(id) ON DELETE SET NULL;

COMMENT ON COLUMN transacoes_financeiras.solicitacao_reembolso_id IS 'Vincula esta transação a uma solicitação de reembolso';

CREATE INDEX IF NOT EXISTS idx_transacoes_solicitacao_reembolso ON transacoes_financeiras(solicitacao_reembolso_id);

-- =====================================================
-- 3. FUNCTION: Atualizar valor total da solicitação
-- =====================================================
CREATE OR REPLACE FUNCTION atualizar_valor_total_reembolso()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcula o valor total somando todas as transações vinculadas
  UPDATE solicitacoes_reembolso
  SET valor_total = (
    SELECT COALESCE(SUM(ABS(valor)), 0)
    FROM transacoes_financeiras
    WHERE solicitacao_reembolso_id = COALESCE(NEW.solicitacao_reembolso_id, OLD.solicitacao_reembolso_id)
    AND tipo = 'despesa'
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.solicitacao_reembolso_id, OLD.solicitacao_reembolso_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para recalcular valor total ao inserir/atualizar/deletar transação
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_reembolso ON transacoes_financeiras;
CREATE TRIGGER trigger_atualizar_valor_total_reembolso
  AFTER INSERT OR UPDATE OR DELETE ON transacoes_financeiras
  FOR EACH ROW
  WHEN (NEW.solicitacao_reembolso_id IS NOT NULL OR OLD.solicitacao_reembolso_id IS NOT NULL)
  EXECUTE FUNCTION atualizar_valor_total_reembolso();

-- =====================================================
-- 4. FUNCTION: Atualizar updated_at automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION atualizar_updated_at_solicitacao()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_updated_at_solicitacao ON solicitacoes_reembolso;
CREATE TRIGGER trigger_updated_at_solicitacao
  BEFORE UPDATE ON solicitacoes_reembolso
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_updated_at_solicitacao();

-- =====================================================
-- 5. RLS (Row Level Security)
-- =====================================================
ALTER TABLE solicitacoes_reembolso ENABLE ROW LEVEL SECURITY;

-- Policy: Usuário pode ver suas próprias solicitações
DROP POLICY IF EXISTS "Usuários podem ver suas próprias solicitações" ON solicitacoes_reembolso;
CREATE POLICY "Usuários podem ver suas próprias solicitações"
  ON solicitacoes_reembolso
  FOR SELECT
  TO authenticated
  USING (
    solicitante_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'tesoureiro', 'financeiro')
    )
  );

-- Policy: Usuário pode criar solicitações para si mesmo
DROP POLICY IF EXISTS "Usuários podem criar suas solicitações" ON solicitacoes_reembolso;
CREATE POLICY "Usuários podem criar suas solicitações"
  ON solicitacoes_reembolso
  FOR INSERT
  TO authenticated
  WITH CHECK (solicitante_id = auth.uid());

-- Policy: Usuário pode editar suas próprias solicitações OU admin/tesoureiro podem editar qualquer uma
DROP POLICY IF EXISTS "Usuários podem editar suas solicitações" ON solicitacoes_reembolso;
CREATE POLICY "Usuários podem editar suas solicitações"
  ON solicitacoes_reembolso
  FOR UPDATE
  TO authenticated
  USING (
    solicitante_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'tesoureiro', 'financeiro')
    )
  );

-- Policy: Apenas pode deletar solicitações em rascunho que são suas
DROP POLICY IF EXISTS "Usuários podem deletar rascunhos" ON solicitacoes_reembolso;
CREATE POLICY "Usuários podem deletar rascunhos"
  ON solicitacoes_reembolso
  FOR DELETE
  TO authenticated
  USING (
    solicitante_id = auth.uid()
    AND status = 'rascunho'
  );

-- =====================================================
-- 6. FUNCTION: Validar transição de status
-- =====================================================
CREATE OR REPLACE FUNCTION validar_status_reembolso()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas admin/tesoureiro podem aprovar ou marcar como pago
  IF NEW.status IN ('aprovado', 'pago', 'rejeitado') AND OLD.status != NEW.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'tesoureiro', 'financeiro')
    ) THEN
      RAISE EXCEPTION 'Apenas administradores ou tesoureiros podem aprovar/pagar/rejeitar solicitações';
    END IF;
  END IF;

  -- Quando marcar como pago, preencher data_pagamento se não estiver preenchida
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.data_pagamento IS NULL THEN
      NEW.data_pagamento = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_status_reembolso ON solicitacoes_reembolso;
CREATE TRIGGER trigger_validar_status_reembolso
  BEFORE UPDATE ON solicitacoes_reembolso
  FOR EACH ROW
  EXECUTE FUNCTION validar_status_reembolso();

-- =====================================================
-- 7. VIEW: Solicitações com informações do solicitante
-- =====================================================
CREATE OR REPLACE VIEW view_solicitacoes_reembolso AS
SELECT 
  sr.*,
  p.nome as solicitante_nome,
  p.email as solicitante_email,
  p.telefone as solicitante_telefone,
  p.avatar_url as solicitante_avatar,
  (
    SELECT COUNT(*)
    FROM transacoes_financeiras tf
    WHERE tf.solicitacao_reembolso_id = sr.id
  ) as quantidade_itens
FROM solicitacoes_reembolso sr
JOIN profiles p ON p.id = sr.solicitante_id
ORDER BY sr.created_at DESC;

COMMENT ON VIEW view_solicitacoes_reembolso IS 'Solicitações de reembolso com dados do solicitante para facilitar consultas';
