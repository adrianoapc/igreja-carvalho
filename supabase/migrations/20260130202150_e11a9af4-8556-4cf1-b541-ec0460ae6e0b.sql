-- 1. Criar função para recalcular valor_total automaticamente
CREATE OR REPLACE FUNCTION atualizar_valor_total_solicitacao()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE solicitacoes_reembolso
  SET valor_total = (
    SELECT COALESCE(SUM(valor), 0) 
    FROM itens_reembolso 
    WHERE solicitacao_id = COALESCE(NEW.solicitacao_id, OLD.solicitacao_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar trigger para itens_reembolso
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_reembolso ON itens_reembolso;
CREATE TRIGGER trigger_atualizar_valor_total_reembolso
AFTER INSERT OR UPDATE OR DELETE ON itens_reembolso
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_total_solicitacao();

-- 3. Corrigir view para contar de itens_reembolso (não de transacoes_financeiras)
CREATE OR REPLACE VIEW view_solicitacoes_reembolso AS
SELECT 
  sr.*,
  p.nome AS solicitante_nome,
  p.email AS solicitante_email,
  p.telefone AS solicitante_telefone,
  p.avatar_url AS solicitante_avatar,
  (SELECT count(*) FROM itens_reembolso ir WHERE ir.solicitacao_id = sr.id) AS quantidade_itens
FROM solicitacoes_reembolso sr
JOIN profiles p ON p.id = sr.solicitante_id
ORDER BY sr.created_at DESC;

-- 4. Recalcular valor_total de todas as solicitações existentes
UPDATE solicitacoes_reembolso sr
SET valor_total = (
  SELECT COALESCE(SUM(valor), 0) 
  FROM itens_reembolso ir 
  WHERE ir.solicitacao_id = sr.id
);