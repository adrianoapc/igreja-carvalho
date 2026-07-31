-- ============================================================================
-- Fix real (Codex, PR #67, 22ª rodada de review): lote de antecipação
-- Getnet ficava travado em 'lancamento_criado' quando a despesa de deságio
-- gerada era revertida (marcada pendente/cancelada, ou excluída) pelo menu
-- normal de transações (TransacaoActionsMenu) — nada nesta PR sincronizava
-- o lote de volta. Efeitos:
--   1) LotesAntecipacaoTab não oferece nenhuma ação nesse estado (só
--      "Concluído"), então não dá pra relançar o deságio.
--   2) fin_conferencia_totais_getnet soma tf.valor de todo lote
--      'lancamento_criado' SEM checar o status atual da transação — a
--      despesa revertida continua contando como deságio lançado na
--      conferência, mesmo não estando mais paga (ou nem existindo mais).
--
-- Fix: trigger em transacoes_financeiras — quando uma linha com
-- origem_registro='getnet_antecipacao_desagio' que estava paga deixa de
-- estar paga (UPDATE pago->não-pago) ou é excluída, reseta o lote
-- correspondente pra status='vinculado' (mantém extrato_bancario_id — o
-- vínculo com o extrato continua válido, só o lançamento de saída que caiu)
-- e limpa lancamento_desagio_id. LotesAntecipacaoTab volta a oferecer
-- "Corrigir vínculo"/"Lançar como saída" naturalmente, e
-- fin_conferencia_totais_getnet para de contar o lote (deixou de estar
-- 'lancamento_criado').
--
-- Branch DELETE hoje é inalcançável na prática: getnet_antecipacao_lotes.
-- lancamento_desagio_id referencia transacoes_financeiras(id) sem ON DELETE
-- (20260729100000) — qualquer DELETE de uma linha ainda referenciada por um
-- lote falha na FK antes de chegar aqui. Mantido como defesa em profundidade
-- caso essa FK mude no futuro; testado isoladamente no harness (sem a FK,
-- pra validar só a lógica do trigger).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sincronizar_lote_antecipacao_ao_reverter_desagio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.origem_registro = 'getnet_antecipacao_desagio' AND OLD.status = 'pago' THEN
      UPDATE public.getnet_antecipacao_lotes
         SET status = 'vinculado', lancamento_desagio_id = NULL, updated_at = now()
       WHERE lancamento_desagio_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE' (só dispara em UPDATE OF status).
  IF OLD.origem_registro = 'getnet_antecipacao_desagio'
     AND OLD.status = 'pago' AND NEW.status <> 'pago' THEN
    UPDATE public.getnet_antecipacao_lotes
       SET status = 'vinculado', lancamento_desagio_id = NULL, updated_at = now()
     WHERE lancamento_desagio_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_sincronizar_lote_antecipacao_ao_reverter_desagio ON public.transacoes_financeiras;
CREATE TRIGGER trigger_sincronizar_lote_antecipacao_ao_reverter_desagio
  AFTER UPDATE OF status OR DELETE ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.sincronizar_lote_antecipacao_ao_reverter_desagio();
