-- Fix: Adicionar search_path à função para eliminar warning
CREATE OR REPLACE FUNCTION atualizar_valor_total_reembolso()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;