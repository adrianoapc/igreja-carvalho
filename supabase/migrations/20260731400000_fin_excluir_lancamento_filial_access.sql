-- ============================================================================
-- Fecha a ÚLTIMA violação do guardrail B.9 nesta PR: `fin_excluir_lancamento`
-- foi reescrita 6× nesta sessão (lock de grupo, reparent, re-resolve da raiz —
-- última em 20260731350000) e ainda NÃO tinha `has_filial_access` nenhum.
-- O comentário na migration 20260731340000 chegou a dizer "sem novo check de
-- filial aqui: já está na lista de §9.68, fora de escopo" — exatamente o
-- anti-padrão que B.9 foi escrito pra impedir ("se já está reescrevendo,
-- feche agora").
--
-- Impacto: SECURITY DEFINER + GRANT EXECUTE TO authenticated. Um tesoureiro
-- restrito à filial B que soubesse o id de um lançamento da filial A
-- conseguia excluí-lo (e, se estava pago, disparar o recálculo de saldo da
-- conta alheia via fin_recalcular_saldo_conta — que AGORA tem o check, mas
-- a exclusão em si ainda acontecia antes dessa chamada).
--
-- Fix: mesmo padrão de `fin_alterar_competencia_grupo` / `fin_atualizar_
-- lancamento` — `has_filial_access(v_igreja, v_atual.filial_id)` logo após a
-- releitura pós-lock. Todas as parcelas de um grupo compartilham filial_id
-- (gravado uma vez na criação), então checar a de v_atual cobre o grupo.
-- ============================================================================

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

  -- Guardrail B.9 — esta função foi reescrita 6× nesta PR sem fechar o
  -- check de filial. Mesmo padrão de fin_alterar_competencia_grupo.
  IF NOT public.has_filial_access(v_igreja, v_atual.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lançamento';
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
