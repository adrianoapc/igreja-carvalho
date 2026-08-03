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
-- Branch DELETE precisa rodar ANTES do delete de fato, não depois: a FK de
-- getnet_antecipacao_lotes.lancamento_desagio_id pra transacoes_financeiras
-- (20260729100000) não tem ON DELETE, então excluir uma linha ainda
-- referenciada por um lote falha na própria checagem de FK — um trigger
-- AFTER DELETE nunca chegaria a rodar (achado do /code-review: a ação
-- "Excluir" do menu ficava sempre falhando pra deságio ainda vinculado, em
-- vez de desvincular o lote e deixar a exclusão seguir). Fix: mesma função,
-- usada em DOIS triggers — BEFORE DELETE (desvincula antes da FK checar) e
-- AFTER UPDATE OF status (reverte pago->não-pago, sem esse problema porque
-- UPDATE não mexe em `id`, então não aciona a FK).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sincronizar_lote_antecipacao_ao_reverter_desagio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_WHEN = 'BEFORE' THEN
    -- BEFORE DELETE: desvincula o lote antes da checagem de FK rodar.
    IF OLD.origem_registro = 'getnet_antecipacao_desagio' AND OLD.status = 'pago' THEN
      UPDATE public.getnet_antecipacao_lotes
         SET status = 'vinculado', lancamento_desagio_id = NULL, updated_at = now()
       WHERE lancamento_desagio_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  -- AFTER UPDATE OF status: reverte pago->não-pago.
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
DROP TRIGGER IF EXISTS trigger_sincronizar_lote_desagio_before_delete ON public.transacoes_financeiras;
DROP TRIGGER IF EXISTS trigger_sincronizar_lote_desagio_after_update ON public.transacoes_financeiras;

CREATE TRIGGER trigger_sincronizar_lote_desagio_before_delete
  BEFORE DELETE ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.sincronizar_lote_antecipacao_ao_reverter_desagio();

CREATE TRIGGER trigger_sincronizar_lote_desagio_after_update
  AFTER UPDATE OF status ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.sincronizar_lote_antecipacao_ao_reverter_desagio();
