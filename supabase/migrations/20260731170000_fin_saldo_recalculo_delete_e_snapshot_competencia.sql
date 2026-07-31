-- ============================================================================
-- 2 achados reais do /code-review (PR #67, 20ª rodada), verificados por
-- leitura direta antes de agir:
--
-- 1) fin_excluir_lancamento — o branch DELETE do trigger (20260731160000)
--    desfaz o movimento assumindo que ele foi de fato aplicado no INSERT.
--    Isso é verdade pra qualquer linha paga criada DEPOIS de 20260731100000
--    (quando o trigger passou a cobrir INSERT). Mas uma linha paga criada
--    ANTES disso, por um escritor de INSERT-direto (fin_lancar_sessao,
--    fin_pagar_reembolso), nunca teve seu movimento aplicado pelo trigger
--    antigo (só cobria UPDATE OF status) — excluir essa linha legada agora
--    desfaz um movimento que nunca existiu, deixando o saldo com um resíduo
--    na direção OPOSTA. As migrations não normalizam/marcam linhas
--    existentes, então não dá pra distinguir "legada" de "nova" só pelos
--    dados da linha.
--
--    Fix: em vez de tentar identificar linhas legadas (marcador, timestamp
--    de deploy — frágil e nenhuma das duas opções é limpa), fin_excluir_
--    lancamento passa a chamar fin_recalcular_saldo_conta(conta_id, true)
--    depois do DELETE de uma linha que estava paga. Recalcular do zero
--    (saldo_inicial + Σ pagas restantes) é autoritativo e não depende de
--    nenhuma suposição sobre o que o trigger aplicou ou não historicamente
--    — corrige tanto o caso novo (onde o trigger já tinha acertado, vira
--    no-op) quanto o legado (onde o trigger errou, vira a correção).
--
-- 2) fin_alterar_competencia_grupo já calculava v_snapshot (data_competencia
--    de cada parcela ANTES da sincronização) só pra auditoria — não
--    devolvia pro chamador. TransacaoDialog.tsx (compensação de §9.41)
--    reverte um grupo já sincronizado guardando só a competência da PARCELA
--    EDITADA, e reaplica esse único valor a TODAS as parcelas se o resto do
--    patch falhar depois — pra um grupo legado que já tinha competências
--    DIVERGENTES entre as parcelas (o caso real que a sincronização existe
--    pra resolver), isso não restaura cada parcela pro seu valor original,
--    e a mensagem final ("nada foi alterado") fica falsa.
--
--    Fix: RPC passa a devolver `snapshot_antes` (id + data_competencia de
--    cada parcela, antes da sincronização) no retorno. Frontend (próximo
--    commit) usa isso pra saber se o grupo já era divergente e ajustar a
--    mensagem de compensação de acordo — restaurar cada linha pro seu
--    valor individual exigiria uma RPC nova (não dá pra fazer via
--    fin_atualizar_lancamento linha a linha: o próprio bloqueio
--    FIN_COMPETENCIA_GRUPO dispararia no meio da restauração), então o
--    best-effort continua sendo sincronizar pra um valor único, mas agora
--    com uma mensagem honesta sobre o que realmente aconteceu.
-- ============================================================================

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

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_lancamento_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_lancamento_id;
  END IF;

  IF v_atual.tipo_lancamento <> 'parcelado' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: fin_alterar_competencia_grupo só se aplica a lançamentos parcelados (tipo_lancamento=%)', v_atual.tipo_lancamento;
  END IF;

  v_pai := COALESCE(v_atual.lancamento_pai_id, v_atual.id);

  -- Trava do grupo inteiro, evitando corrida com outra edição concorrente.
  PERFORM 1 FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja AND (id = v_pai OR lancamento_pai_id = v_pai)
   FOR UPDATE;

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

-- ─── fin_excluir_lancamento recalcula saldo ao excluir linha paga ─────────

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

  -- trigger_atualizar_saldo_conta (branch DELETE, 20260731160000) desfaz o
  -- movimento assumindo que o INSERT original o aplicou — verdade só pra
  -- linhas criadas depois de 20260731100000. Recalcular do zero corrige os
  -- dois casos (novo: no-op; legado: corrige o resíduo que o trigger deixou
  -- na direção errada) sem precisar distinguir a idade da linha excluída.
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
