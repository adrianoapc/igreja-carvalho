-- ==========================================================
-- MIGRATION: Corrigir trigger para somar itens_reembolso
-- Alinha arquitetura com ADR-001 (Fato Gerador vs Fluxo de Caixa)
-- ==========================================================

-- 1. Drop trigger antigo (estava na tabela errada)
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_reembolso ON transacoes_financeiras;
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_reembolso ON itens_reembolso;

-- 2. Recriar função para somar itens_reembolso (fato gerador)
CREATE OR REPLACE FUNCTION atualizar_valor_total_reembolso()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcula o valor total somando todos os ITENS vinculados (não transações)
  UPDATE solicitacoes_reembolso
  SET valor_total = (
    SELECT COALESCE(SUM(ABS(valor)), 0)
    FROM itens_reembolso
    WHERE solicitacao_id = COALESCE(NEW.solicitacao_id, OLD.solicitacao_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger na tabela correta (itens_reembolso)
CREATE TRIGGER trigger_atualizar_valor_total_reembolso
  AFTER INSERT OR UPDATE OR DELETE ON itens_reembolso
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_total_reembolso();

-- 4. Adicionar policy para edge functions inserirem itens_reembolso
-- (service_role já tem bypass, mas garantindo para casos de RLS estrito)
DROP POLICY IF EXISTS "Edge functions podem inserir itens_reembolso" ON itens_reembolso;
CREATE POLICY "Edge functions podem inserir itens_reembolso" ON itens_reembolso
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM solicitacoes_reembolso sr
      JOIN profiles p ON p.id = sr.solicitante_id
      WHERE sr.id = itens_reembolso.solicitacao_id
      AND p.user_id = auth.uid()
      AND sr.status IN ('rascunho', 'pendente')
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'tesoureiro'::app_role)
  );