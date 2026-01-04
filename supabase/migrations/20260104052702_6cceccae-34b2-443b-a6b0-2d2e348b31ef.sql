
-- Remover triggers e função existentes com CASCADE
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_reembolso_insert_update ON public.transacoes_financeiras;
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_reembolso_delete ON public.transacoes_financeiras;
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_reembolso ON public.itens_reembolso;
DROP FUNCTION IF EXISTS public.atualizar_valor_total_reembolso() CASCADE;

-- Recriar função corrigida
CREATE OR REPLACE FUNCTION public.atualizar_valor_total_reembolso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualiza o valor total da solicitação de reembolso
  UPDATE solicitacoes_reembolso
  SET valor_total = (
    SELECT COALESCE(SUM(ABS(valor)), 0)
    FROM transacoes_financeiras
    WHERE solicitacao_reembolso_id = COALESCE(NEW.solicitacao_reembolso_id, OLD.solicitacao_reembolso_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.solicitacao_reembolso_id, OLD.solicitacao_reembolso_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recriar triggers na tabela transacoes_financeiras
CREATE TRIGGER trigger_atualizar_valor_total_reembolso_insert_update
  AFTER INSERT OR UPDATE ON public.transacoes_financeiras
  FOR EACH ROW
  WHEN (NEW.solicitacao_reembolso_id IS NOT NULL)
  EXECUTE FUNCTION public.atualizar_valor_total_reembolso();

CREATE TRIGGER trigger_atualizar_valor_total_reembolso_delete
  AFTER DELETE ON public.transacoes_financeiras
  FOR EACH ROW
  WHEN (OLD.solicitacao_reembolso_id IS NOT NULL)
  EXECUTE FUNCTION public.atualizar_valor_total_reembolso();
