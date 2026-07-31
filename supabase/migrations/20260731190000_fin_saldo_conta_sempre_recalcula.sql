-- ============================================================================
-- Fix na RAIZ (decisão explícita do usuário, PR #67, 22ª rodada de review)
-- pra 3 achados da MESMA classe de bug em 3 rodadas seguidas:
--   §9.47 — DELETE de linha paga legada via fin_excluir_lancamento
--   §9.48 — DELETE de linha paga legada via undo-import (caminho diferente)
--   §9.49 (P1 desta migration) — UPDATE pago->pendente de linha paga legada
--     via "Marcar como Pendente" (fin_alterar_status_lancamento)
--
-- Causa raiz: atualizar_saldo_conta() fazia matemática INCREMENTAL — cada
-- branch que precisa "desfazer" um movimento assume que esse movimento foi
-- de fato aplicado quando a linha ficou paga. Verdade só pra linhas cujo
-- INSERT rodou com o trigger já cobrindo INSERT (desde 20260731100000).
-- Uma linha paga criada ANTES disso por um escritor de INSERT-direto
-- (fin_lancar_sessao, fin_pagar_reembolso) nunca teve seu movimento
-- aplicado — qualquer branch que tentasse desfazê-lo (DELETE, UPDATE
-- saindo de pago, edição de valor/conta/tipo com status pago) corrompia o
-- saldo. 3 patches pontuais (§9.47/§9.48) já cobriam 2 dos casos; o 3º
-- achado desta rodada (UPDATE) confirmou que ia continuar aparecendo em
-- qualquer caminho novo ou existente que ainda não tivesse sido "achado".
--
-- Fix definitivo: o trigger NUNCA MAIS soma/subtrai incrementalmente.
-- Qualquer evento que envolva uma linha paga (INSERT pago, DELETE de paga,
-- UPDATE onde OLD.status='pago' OU NEW.status='pago' — cobre transição de
-- status nos dois sentidos E edição de valor/conta/tipo mantendo status
-- pago, já que fin_atualizar_lancamento sempre inclui status no SET,
-- garantindo que UPDATE OF status dispara mesmo sem mudar o valor do
-- status) recalcula a(s) conta(s) afetada(s) DO ZERO
-- (saldo_inicial + Σ pagas atuais), a mesma fórmula autoritativa de
-- fin_recalcular_saldo_conta. Elimina a classe de bug inteira,
-- permanentemente, em qualquer caminho atual ou futuro — não depende mais
-- de nenhuma suposição sobre o que um INSERT anterior aplicou ou não.
--
-- Custo: uma SUM sobre as transações pagas da conta a cada evento, em vez
-- de O(1). Aceitável na escala esperada (transações por conta de uma
-- igreja, não milhões de linhas); troca deliberada em favor de correção
-- permanente sobre performance marginal.
--
-- fin_excluir_lancamento (chamada explícita a fin_recalcular_saldo_conta,
-- §9.47) e undo-import (loop de recálculo por conta, §9.48) ficam
-- redundantes — o trigger já garante o resultado correto sozinho agora.
-- Removidos nesta mesma migration/commit pra não recalcular a mesma conta
-- 2x à toa.
-- ============================================================================

-- ─── Helper interno: recalcula sem depender de fin_resolver_contexto ──────
-- Sem contexto/permissão nenhuma de propósito — é chamado de dentro do
-- trigger (que já roda SECURITY DEFINER, disparado por qualquer caller,
-- inclusive service_role sem p_contexto) e não deve exigir nada que um
-- INSERT/UPDATE/DELETE comum não tenha. Não é uma RPC pública: sem GRANT
-- pra authenticated/anon, só o owner (chamado internamente) executa.
CREATE OR REPLACE FUNCTION public._fin_recalcular_saldo_conta_raw(p_conta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_conta_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.contas c
     SET saldo_atual = COALESCE(c.saldo_inicial, 0) + COALESCE((
           SELECT SUM(CASE WHEN t.tipo = 'entrada' THEN COALESCE(t.valor_liquido, t.valor)
                            ELSE -COALESCE(t.valor_liquido, t.valor) END)
             FROM public.transacoes_financeiras t
            WHERE t.conta_id = p_conta_id AND t.status = 'pago'
         ), 0),
         updated_at = now()
   WHERE c.id = p_conta_id;
END;
$$;

REVOKE ALL ON FUNCTION public._fin_recalcular_saldo_conta_raw(uuid) FROM PUBLIC, authenticated, anon, service_role;

-- ─── Trigger: sempre recalcula, nunca mais soma/subtrai incrementalmente ──

CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'pago' THEN
      PERFORM public._fin_recalcular_saldo_conta_raw(OLD.conta_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pago' THEN
      PERFORM public._fin_recalcular_saldo_conta_raw(NEW.conta_id);
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' (dispara em UPDATE OF status — presente no SET de
  -- fin_atualizar_lancamento/fin_alterar_status_lancamento mesmo quando o
  -- valor do status em si não muda, cobrindo também edição de
  -- valor/valor_liquido/conta_id/tipo numa linha que continua paga).
  IF OLD.status = 'pago' OR NEW.status = 'pago' THEN
    PERFORM public._fin_recalcular_saldo_conta_raw(OLD.conta_id);
    IF NEW.conta_id IS DISTINCT FROM OLD.conta_id THEN
      PERFORM public._fin_recalcular_saldo_conta_raw(NEW.conta_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ─── fin_excluir_lancamento: remove a chamada explícita, agora redundante ──

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

  -- trigger_atualizar_saldo_conta (20260731190000) recalcula do zero
  -- sozinho no DELETE de qualquer linha paga — não precisa mais de chamada
  -- explícita a fin_recalcular_saldo_conta aqui (§9.47, agora redundante).

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_excluir_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('escopo', v_escopo,
                       'snapshot', to_jsonb(v_atual)),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings));
END;
$$;
