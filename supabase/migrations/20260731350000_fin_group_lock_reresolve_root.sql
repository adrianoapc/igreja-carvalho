-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 02/08 15:41, commit revisado
-- cd5a2e1e), real — e a mesma classe de bug se repete em fin_excluir_
-- lancamento, que eu escrevi com o MESMO padrão na mesma migration (§9.74)
-- e não tinha verificado contra este cenário específico.
--
-- O padrão "resolve a raiz do grupo (v_pai) com um SELECT sem lock, trava
-- o grupo inteiro depois" (§9.72/§9.74, pra evitar deadlock — guardrail
-- D.5) tem uma janela: se ENQUANTO esta chamada espera o lock do grupo,
-- OUTRA sessão concorrente excluir a raiz e reparentear o grupo (fin_
-- excluir_lancamento), o `v_pai` resolvido ANTES de esperar fica
-- APONTANDO PRA UM ID QUE NÃO EXISTE MAIS (a raiz antiga, deletada) ou
-- que ninguém mais referencia como pai. Quando o lock libera, o
-- predicado `(id = v_pai OR lancamento_pai_id = v_pai)` não bate com
-- NENHUMA linha — Postgres trava 0 linhas (EvalPlanQual re-checa o
-- predicado e não acha nada), e TODA query seguinte que usa `v_pai`
-- (inclusive o UPDATE final) também não bate com nada. A RPC retorna
-- sucesso (`ok: true`) mas não atualiza nenhuma parcela — falha
-- silenciosa, sem erro nenhum pro chamador perceber.
--
-- Fix: depois de adquirir o lock do grupo, RE-RESOLVE a raiz da mesma
-- forma (mesmo SELECT). Se o valor mudou em relação ao que foi usado pra
-- travar, o grupo foi alterado por uma transação concorrente enquanto
-- esperávamos — o lock que acabamos de adquirir pode não cobrir o grupo
-- REAL (ou cobrir um grupo que não existe mais); refaz o ciclo inteiro
-- (resolve → trava → confere) com a raiz atualizada, até estabilizar (a
-- raiz resolvida ANTES de travar bater com a raiz resolvida DEPOIS de
-- travar — nesse ponto, garantidamente ninguém mais está reparenteando,
-- porque o lock do grupo real está em mãos). Aplicado nas DUAS funções
-- que usam este padrão (`fin_alterar_competencia_grupo` e `fin_excluir_
-- lancamento`) — a mesma classe, mesmo não citada pelo achado desta
-- rodada pra esta segunda função.
-- ============================================================================

-- ─── 1. fin_excluir_lancamento — re-resolve a raiz após o lock ─────────────

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
  v_pai_confirmado uuid;
  v_irmas int;
  v_a_excluir uuid[];
  v_novo_pai uuid;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Resolve a raiz, trava o grupo, confere se a raiz ainda é a mesma
  -- DEPOIS do lock — repete se uma exclusão/reparenting concorrente
  -- mudou a estrutura do grupo enquanto esperávamos o lock (achado do
  -- /code-review sobre fin_alterar_competencia_grupo, mesma classe aqui).
  LOOP
    SELECT COALESCE(lancamento_pai_id, id) INTO v_pai
      FROM public.transacoes_financeiras
     WHERE id = p_id AND igreja_id = v_igreja;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
    END IF;

    PERFORM 1 FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja AND (id = v_pai OR lancamento_pai_id = v_pai)
     ORDER BY id
       FOR UPDATE;

    SELECT COALESCE(lancamento_pai_id, id) INTO v_pai_confirmado
      FROM public.transacoes_financeiras
     WHERE id = p_id AND igreja_id = v_igreja;
    EXIT WHEN v_pai_confirmado IS NOT DISTINCT FROM v_pai;
  END LOOP;

  -- Releitura pós-lock, snapshot fresco.
  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser excluído (D4); desconcilie antes';
  END IF;

  IF v_escopo = 'este_e_futuras' THEN
    SELECT array_agg(id) INTO v_a_excluir
      FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja
       AND (id = p_id
            OR ((lancamento_pai_id = v_pai OR id = v_pai)
                AND data_vencimento >= v_atual.data_vencimento
                AND status = 'pendente'
                AND (conciliacao_status IS NULL
                     OR conciliacao_status NOT IN ('conciliado_extrato','conciliado_bot'))));
  ELSE
    v_a_excluir := ARRAY[p_id];
  END IF;

  IF v_atual.id = ANY(v_a_excluir) AND v_atual.lancamento_pai_id IS NULL THEN
    SELECT id INTO v_novo_pai
      FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja
       AND lancamento_pai_id = v_atual.id
       AND NOT (id = ANY(v_a_excluir))
     ORDER BY data_vencimento ASC, id ASC
     LIMIT 1;

    IF v_novo_pai IS NOT NULL THEN
      UPDATE public.transacoes_financeiras SET lancamento_pai_id = NULL, updated_at = now()
       WHERE id = v_novo_pai;
      UPDATE public.transacoes_financeiras SET lancamento_pai_id = v_novo_pai, updated_at = now()
       WHERE igreja_id = v_igreja
         AND lancamento_pai_id = v_atual.id
         AND id <> v_novo_pai
         AND NOT (id = ANY(v_a_excluir));
      v_warnings := v_warnings ||
        format('grupo reparenteado: parcela/ocorrência %s vira a nova referência do grupo', v_novo_pai);
    END IF;
  END IF;

  IF v_escopo = 'este_e_futuras' THEN
    WITH del AS (
      DELETE FROM public.transacoes_financeiras
       WHERE id = ANY(v_a_excluir)
      RETURNING id
    )
    SELECT array_agg(id) INTO v_ids FROM del;
  ELSE
    DELETE FROM public.transacoes_financeiras WHERE id = p_id;
    v_ids := ARRAY[p_id];

    SELECT count(*) INTO v_irmas FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja
       AND (lancamento_pai_id = COALESCE(v_novo_pai, v_atual.lancamento_pai_id, v_atual.id)
            OR id = COALESCE(v_novo_pai, v_atual.lancamento_pai_id));
    IF v_irmas > 0 THEN
      v_warnings := v_warnings ||
        format('%s parcela(s)/ocorrência(s) irmã(s) permanecem; use escopo este_e_futuras para remover as futuras', v_irmas);
    END IF;
  END IF;

  IF v_atual.status = 'pago' THEN
    PERFORM public.fin_recalcular_saldo_conta(v_atual.conta_id, true, v_ctx);
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_excluir_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('escopo', v_escopo,
                       'snapshot', to_jsonb(v_atual)),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 2. fin_alterar_competencia_grupo — re-resolve a raiz após o lock ──────

CREATE OR REPLACE FUNCTION public.fin_alterar_competencia_grupo(
  p_lancamento_id uuid,
  p_nova_competencia date,
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
  v_pai uuid;
  v_pai_confirmado uuid;
  v_ids uuid[];
  v_conciliadas uuid[];
  v_pagas int;
  v_warnings text[] := '{}';
  v_snapshot jsonb;
BEGIN
  IF p_nova_competencia IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: nova competência é obrigatória';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Resolve a raiz, trava o grupo, confere se a raiz ainda é a mesma
  -- DEPOIS do lock — repete se uma exclusão/reparenting concorrente
  -- (fin_excluir_lancamento) mudou a estrutura do grupo enquanto
  -- esperávamos o lock. Sem isso: v_pai resolvido ANTES de esperar podia
  -- apontar pra uma raiz já deletada/reparenteada; quando o lock libera,
  -- o predicado (id = v_pai OR lancamento_pai_id = v_pai) não bate com
  -- NENHUMA linha (Postgres trava 0), e o UPDATE final também não bate
  -- com nada — a RPC retornava sucesso sem atualizar nenhuma parcela,
  -- falha silenciosa (achado do /code-review).
  LOOP
    SELECT COALESCE(lancamento_pai_id, id) INTO v_pai
      FROM public.transacoes_financeiras
     WHERE id = p_lancamento_id AND igreja_id = v_igreja;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_lancamento_id;
    END IF;

    PERFORM 1 FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja AND (id = v_pai OR lancamento_pai_id = v_pai)
     ORDER BY id
       FOR UPDATE;

    SELECT COALESCE(lancamento_pai_id, id) INTO v_pai_confirmado
      FROM public.transacoes_financeiras
     WHERE id = p_lancamento_id AND igreja_id = v_igreja;
    EXIT WHEN v_pai_confirmado IS NOT DISTINCT FROM v_pai;
  END LOOP;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_lancamento_id AND igreja_id = v_igreja;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_lancamento_id;
  END IF;

  IF NOT public.has_filial_access(v_igreja, v_atual.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lançamento';
  END IF;

  IF v_atual.tipo_lancamento <> 'parcelado' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: fin_alterar_competencia_grupo só se aplica a lançamentos parcelados (tipo_lancamento=%)', v_atual.tipo_lancamento;
  END IF;

  SELECT array_agg(id) INTO v_conciliadas
    FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja
     AND (id = v_pai OR lancamento_pai_id = v_pai)
     AND conciliacao_status IN ('conciliado_extrato','conciliado_bot');

  IF v_conciliadas IS NOT NULL AND array_length(v_conciliadas, 1) > 0 THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: % parcela(s) do grupo já conciliada(s) (%); desconcilie antes de sincronizar a competência',
      array_length(v_conciliadas, 1), array_to_string(v_conciliadas, ', ');
  END IF;

  SELECT jsonb_agg(jsonb_build_object('id', id, 'data_competencia', data_competencia))
    INTO v_snapshot
    FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja
     AND (id = v_pai OR lancamento_pai_id = v_pai);

  SELECT count(*) INTO v_pagas
    FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja
     AND (id = v_pai OR lancamento_pai_id = v_pai)
     AND status = 'pago';

  WITH upd AS (
    UPDATE public.transacoes_financeiras
       SET data_competencia = p_nova_competencia, updated_at = now()
     WHERE igreja_id = v_igreja
       AND (id = v_pai OR lancamento_pai_id = v_pai)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_ids FROM upd;

  IF v_pagas > 0 THEN
    v_warnings := v_warnings ||
      format('%s parcela(s) já paga(s) tiveram a competência alterada; revise o DRE por competência do(s) período(s) afetado(s)', v_pagas);
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_alterar_competencia_grupo', 'transacoes_financeiras', v_pai,
    jsonb_build_object('nova_competencia', p_nova_competencia, 'snapshot_antes', v_snapshot),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings),
                            'snapshot_antes', v_snapshot);
END;
$$;
