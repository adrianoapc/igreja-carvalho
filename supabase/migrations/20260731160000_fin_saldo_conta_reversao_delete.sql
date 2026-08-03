-- ============================================================================
-- Fix real (Codex, PR #67, 16ª rodada de review) sobre atualizar_saldo_conta
-- (última versão: 20260731130000) + trigger (20260731100000).
--
-- 20260731100000 estendeu o trigger pra cobrir AFTER INSERT (além de
-- UPDATE OF status), pra RPCs que criam lançamento já 'pago' direto
-- (fin_lancar_sessao, fin_pagar_reembolso, fin_lancar_desagio_antecipacao)
-- moverem saldo corretamente na criação. Isso teve um efeito colateral não
-- percebido: `fin_excluir_lancamento` sempre fez DELETE físico da linha
-- (inclusive linha paga — só emite um warning, não bloqueia, decisão
-- deliberada de antes desta PR, mitigada pelo botão "Recalcular Saldo").
-- Antes de 20260731100000, deletar uma transação paga criada via INSERT
-- direto era neutro pro saldo (o trigger nunca tinha movido nada nesse
-- INSERT). Depois de 20260731100000, o INSERT passou a mover — mas o
-- trigger nunca ganhou um branch de DELETE, então agora deletar essa mesma
-- transação paga NÃO desfaz o movimento: o saldo fica com um resíduo real
-- (a mesma classe de drift que o warning de fin_excluir_lancamento já
-- alertava, só que agora acontece SEMPRE que uma transação paga recém-
-- criada é excluída, não só num caso raro).
--
-- Fix: trigger ganha um branch TG_OP = 'DELETE', desfazendo o movimento
-- (OLD.tipo/OLD.valor_liquido) quando a linha excluída estava paga — mesmo
-- raciocínio já usado no branch "pago -> pendente/cancelado". Trigger
-- recriado incluindo DELETE no evento. Warning de fin_excluir_lancamento
-- removido: deixou de ser verdade (saldo agora É recalculado
-- automaticamente na exclusão de uma linha paga).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'pago' THEN
      IF OLD.tipo = 'entrada' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
         WHERE id = OLD.conta_id;
      ELSIF OLD.tipo = 'saida' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
         WHERE id = OLD.conta_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pago' THEN
      IF NEW.tipo = 'entrada' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
         WHERE id = NEW.conta_id;
      ELSIF NEW.tipo = 'saida' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
         WHERE id = NEW.conta_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' (só dispara em UPDATE OF status — presente no SET de
  -- fin_atualizar_lancamento/fin_alterar_status_lancamento mesmo quando o
  -- valor do status em si não muda).
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    -- pendente/cancelado -> pago: aplica o movimento NOVO (NEW.tipo — é a
    -- confirmação que está acontecendo agora, com o tipo atual do patch).
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    -- pago -> pendente/cancelado: desfaz o movimento ANTIGO — usa OLD.tipo
    -- (o tipo que efetivamente gerou o movimento quando ficou pago), não
    -- NEW.tipo, que pode ter mudado no mesmo patch junto com o status.
    IF OLD.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    ELSIF OLD.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status = 'pago' THEN
    -- pago -> pago: desfaz o movimento antigo (conta/tipo/valor de antes) e
    -- aplica o novo — cobre edição de valor numa mesma conta E o caso mais
    -- raro de trocar conta_id/tipo mantendo status pago.
    IF OLD.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    ELSIF OLD.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    END IF;
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_atualizar_saldo_conta ON public.transacoes_financeiras;
CREATE TRIGGER trigger_atualizar_saldo_conta
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_conta();

-- ─── fin_excluir_lancamento: remove o warning que deixou de ser verdade ────

CREATE OR REPLACE FUNCTION public.fin_excluir_lancamento(
  p_id uuid,
  p_extras jsonb DEFAULT '{}'::jsonb,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_atual public.transacoes_financeiras%ROWTYPE;
  v_escopo text := COALESCE(p_extras ->> 'escopo', 'somente_este');
  v_ids uuid[] := '{}';
  v_warnings text[] := '{}';
  v_pai uuid;
  v_irmas int;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser excluído (D4); desconcilie antes';
  END IF;

  -- trigger_atualizar_saldo_conta agora cobre DELETE (20260731160000) —
  -- excluir uma linha paga desfaz o movimento automaticamente, não precisa
  -- mais do warning nem de fin_recalcular_saldo_conta manual pra este caso.

  IF v_escopo = 'este_e_futuras' THEN
    v_pai := COALESCE(v_atual.lancamento_pai_id, v_atual.id);
    WITH del AS (
      DELETE FROM public.transacoes_financeiras
       WHERE igreja_id = v_igreja
         AND (id = p_id
              OR ((lancamento_pai_id = v_pai OR id = v_pai)
                  AND data_vencimento >= v_atual.data_vencimento
                  AND status = 'pendente'
                  AND conciliacao_status NOT IN ('conciliado_extrato','conciliado_bot')))
      RETURNING id
    )
    SELECT array_agg(id) INTO v_ids FROM del;
  ELSE
    DELETE FROM public.transacoes_financeiras WHERE id = p_id;
    v_ids := ARRAY[p_id];

    SELECT count(*) INTO v_irmas FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja
       AND (lancamento_pai_id = COALESCE(v_atual.lancamento_pai_id, v_atual.id)
            OR id = v_atual.lancamento_pai_id);
    IF v_irmas > 0 THEN
      v_warnings := v_warnings ||
        format('%s parcela(s)/ocorrência(s) irmã(s) permanecem; use escopo este_e_futuras para remover as futuras', v_irmas);
    END IF;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_excluir_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('escopo', v_escopo,
                       'snapshot', to_jsonb(v_atual)),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings));
END;
$$;
