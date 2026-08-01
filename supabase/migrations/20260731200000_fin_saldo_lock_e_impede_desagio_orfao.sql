-- ============================================================================
-- 2 achados P1 reais do /code-review (PR #67, 23ª rodada), verificados por
-- leitura direta, sobre os 2 commits mais recentes desta mesma PR:
--
-- 1) _fin_recalcular_saldo_conta_raw (20260731190000) fazia UPDATE contas
--    SET saldo_atual = (SELECT SUM(...) ...) num único statement. A
--    subquery do SET usa o snapshot da transação/statement de QUEM CHAMOU,
--    tirado no INÍCIO desse UPDATE — mesmo que o UPDATE espere (lock wait)
--    outra transação concorrente recalculando a MESMA conta terminar, essa
--    espera só re-checa (EvalPlanQual) as colunas da PRÓPRIA linha de
--    `contas` sendo travada; a subquery sobre transacoes_financeiras não
--    ganha um snapshot novo depois da espera. Duas transações inserindo
--    pago pra mesma conta ao mesmo tempo: a segunda espera a trava da
--    primeira, mas quando prossegue ainda soma com o snapshot de ANTES de
--    esperar (sem ver a linha que a primeira acabou de commitar) —
--    sobrescreve saldo_atual com uma soma que já nasce sem um dos dois
--    movimentos.
--
--    Fix: trava a conta (SELECT ... FOR UPDATE) numa statement separada
--    ANTES da soma — depois que a espera termina, a PRÓXIMA statement (a
--    soma) é nova e pega um snapshot fresco (READ COMMITTED: cada
--    statement tem seu próprio snapshot), agora já vendo o que a outra
--    transação commitou. Mesmo padrão que fin_recalcular_saldo_conta
--    (RPC pública, 20260710120000/20260730110000) já usava — só o helper
--    interno novo tinha colapsado tudo num único UPDATE.
--
-- 2) sincronizar_lote_antecipacao_ao_reverter_desagio (20260731180000)
--    reseta o LOTE (status='vinculado', lancamento_desagio_id=NULL)
--    quando a despesa de deságio é revertida — mas a transação original
--    continua existindo, com origem_registro='getnet_antecipacao_desagio',
--    disponível pro "Marcar como Pago" comum. Como o lote já nasceu direto
--    pago (fin_criar_lancamento com status='pago' no INSERT — nunca passa
--    por pendente->pago na criação), a ÚNICA forma de uma linha
--    origem_registro='getnet_antecipacao_desagio' fazer a transição
--    pendente/cancelado->pago é justamente essa reativação órfã. Sem
--    guarda, o usuário podia pagar de novo a transação órfã E lançar um
--    deságio novo pelo lote (já resetado pra 'vinculado') — deságio
--    contado duas vezes, e fin_conferencia_totais_getnet só vê o novo
--    (lote não referencia mais a órfã).
--
--    Fix: trigger BEFORE UPDATE novo — rejeita explicitamente reativar
--    (pendente/cancelado -> pago) uma linha origem_registro=
--    'getnet_antecipacao_desagio' que não é mais referenciada por nenhum
--    lote (lancamento_desagio_id). Mensagem orienta lançar um novo deságio
--    pelo lote em vez de tentar reaproveitar a linha órfã.
-- ============================================================================

-- ─── 1. Trava a conta ANTES de somar (statements separadas) ──────────────

CREATE OR REPLACE FUNCTION public._fin_recalcular_saldo_conta_raw(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric;
  v_calculado numeric;
BEGIN
  IF p_conta_id IS NULL THEN
    RETURN;
  END IF;

  -- Trava a linha ANTES de somar. Se outra transação concorrente também
  -- estiver recalculando esta mesma conta, espera aqui até ela commitar —
  -- a consulta seguinte (SELECT SUM), sendo uma statement NOVA, pega um
  -- snapshot fresco (READ COMMITTED) já enxergando o que a outra transação
  -- acabou de commitar (achado do /code-review sobre a versão anterior,
  -- que fazia tudo num único UPDATE com subquery no SET).
  SELECT saldo_inicial INTO v_saldo_inicial FROM public.contas WHERE id = p_conta_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(v_saldo_inicial, 0) + COALESCE(SUM(
           CASE WHEN tipo = 'entrada' THEN COALESCE(valor_liquido, valor)
                ELSE -COALESCE(valor_liquido, valor) END
         ), 0)
    INTO v_calculado
    FROM public.transacoes_financeiras
   WHERE conta_id = p_conta_id AND status = 'pago';

  UPDATE public.contas SET saldo_atual = v_calculado, updated_at = now() WHERE id = p_conta_id;
END;
$$;

-- ─── 2. Impede reativar transação de deságio órfã ─────────────────────────

CREATE OR REPLACE FUNCTION public.impedir_reativar_desagio_orfao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'pago' AND OLD.status <> 'pago'
     AND OLD.origem_registro = 'getnet_antecipacao_desagio'
     AND NOT EXISTS (
       SELECT 1 FROM public.getnet_antecipacao_lotes
        WHERE lancamento_desagio_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'FIN_DESAGIO_ORFAO: este lançamento era o deságio de um lote de antecipação Getnet cujo vínculo já foi desfeito (revertido antes) — não pode ser marcado como pago de novo, senão o deságio seria contado duas vezes. Lance um novo deságio pelo lote em Reconciliação Bancária > Lotes de Antecipação.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_impedir_reativar_desagio_orfao ON public.transacoes_financeiras;
CREATE TRIGGER trigger_impedir_reativar_desagio_orfao
  BEFORE UPDATE OF status ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.impedir_reativar_desagio_orfao();
