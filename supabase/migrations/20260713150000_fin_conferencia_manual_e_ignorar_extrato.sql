-- F7 (sub-frente 1/5, continuação): duas RPCs novas para fechar os últimos
-- call-sites de escrita direta em transacoes_financeiras/extratos_bancarios
-- que a migration 20260713141000 deixou de fora (ver docs/arquitetura-
-- financeiro.md §9.7). Nenhuma RPC existente cobria estas duas operações:
--
-- 1) "Conferência manual" de um lançamento (marcar/desmarcar
--    conferido_manual + conciliacao_status=conciliado_manual, sem extrato
--    correspondente — dinheiro conferido em caixa). Usada hoje por
--    TransacaoActionsMenu (toggle nos dois sentidos) e ConciliacaoInteligente
--    (marcar, um sentido só). fin_confirmar_conciliacao não serve: exige
--    sempre um extrato_ids não vazio.
-- 2) "Ignorar/reativar" uma linha de extrato bancário SEM nenhum vínculo de
--    conciliação (ruído do extrato que não deve aparecer como pendente).
--    Usada por HistoricoExtratos, ConciliacaoManual e DashboardConciliacao.
--    fin_ingerir_extratos/fin_desfazer_ingestao não servem: são sobre criação
--    de extrato em lote, não sobre alternar uma flag de um já existente.
--
-- Checklist de segurança (docs/arquitetura-financeiro.md §7.2): ambas usam
-- fin_resolver_contexto (mesmo gate admin|tesoureiro no JWT / p_contexto
-- estrito no service role das demais RPCs fin_*), escopam a linha pelo
-- igreja_id do contexto (FOR UPDATE ... WHERE id = $1 AND igreja_id = $2 —
-- mesmo padrão de fin_atualizar_lancamento/fin_alterar_status_lancamento/
-- fin_desconciliar; não há seleção de filial nem candidatos multi-linha aqui,
-- então o item do checklist sobre CTE/p_filial_id não se aplica a uma RPC de
-- alternância pontual por id), respeitam a imutabilidade D4 (bloqueiam
-- alternar conferência/ignorar quando já há conciliação real via
-- extrato/lote/divisão — evita o estado "dangling" que o fallback antigo do
-- frontend podia produzir) e registram em fin_audit_log.

-- ─── 1. fin_alternar_conferencia_manual ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_alternar_conferencia_manual(
  p_id uuid,
  p_conferido boolean,
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
  v_novo_status text;
  v_irmas int := 0;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  -- D4: já conciliado via extrato/bot é imutável por este caminho.
  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado via extrato/bot não pode ter a conferência manual alternada (D4); desconcilie antes';
  END IF;

  v_novo_status := CASE WHEN p_conferido THEN 'conciliado_manual' ELSE 'nao_conciliado' END;

  UPDATE public.transacoes_financeiras
     SET conferido_manual = p_conferido,
         conciliacao_status = v_novo_status,
         updated_at = now()
   WHERE id = p_id;

  -- Perna irmã da transferência acompanha (mesmo padrão do
  -- fin_confirmar_conciliacao) — só se ela mesma não estiver conciliada via
  -- extrato/bot (imutabilidade D4 vale para a irmã também).
  IF v_atual.transferencia_id IS NOT NULL THEN
    UPDATE public.transacoes_financeiras
       SET conferido_manual = p_conferido,
           conciliacao_status = v_novo_status,
           updated_at = now()
     WHERE transferencia_id = v_atual.transferencia_id
       AND id <> p_id
       AND igreja_id = v_igreja
       AND conciliacao_status NOT IN ('conciliado_extrato','conciliado_bot');
    GET DIAGNOSTICS v_irmas = ROW_COUNT;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_alternar_conferencia_manual', 'transacoes_financeiras', p_id,
    jsonb_build_object('conferido', p_conferido),
    jsonb_build_object('conciliacao_status', v_novo_status, 'irma_sincronizada', v_irmas > 0));

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'conciliacao_status', v_novo_status);
END;
$$;

COMMENT ON FUNCTION public.fin_alternar_conferencia_manual(uuid, boolean, jsonb) IS
  'Alterna conferido_manual + conciliacao_status (nao_conciliado<->conciliado_manual) de um lançamento, sem extrato correspondente (F7). Sincroniza a perna irmã de transferência. Bloqueia se já conciliado via extrato/bot (D4).';

GRANT EXECUTE ON FUNCTION public.fin_alternar_conferencia_manual(uuid, boolean, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_alternar_conferencia_manual(uuid, boolean, jsonb) FROM anon;

-- ─── 2. fin_marcar_extrato_ignorado ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_marcar_extrato_ignorado(
  p_extrato_id uuid,
  p_ignorado boolean,
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
  v_atual public.extratos_bancarios%ROWTYPE;
  v_em_lote boolean;
  v_em_divisao boolean;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.extratos_bancarios
   WHERE id = p_extrato_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: extrato % fora do tenant ou inexistente', p_extrato_id;
  END IF;

  -- Só para extratos genuinamente SEM vínculo (o "ruído" que a tela deixa de
  -- mostrar como pendente) — nunca para um extrato realmente conciliado por
  -- qualquer um dos 3 mecanismos (evita o estado dangling que o fallback
  -- antigo do frontend produzia ao limpar reconciliado sem checar lote/divisão).
  IF v_atual.transacao_vinculada_id IS NOT NULL THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: extrato % está vinculado 1:1 a uma transação; use fin_desconciliar', p_extrato_id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.conciliacoes_lote_extratos WHERE extrato_id = p_extrato_id)
    INTO v_em_lote;
  IF v_em_lote THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: extrato % está em um lote de conciliação; use fin_desconciliar na transação', p_extrato_id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.conciliacoes_divisao WHERE extrato_id = p_extrato_id)
    INTO v_em_divisao;
  IF v_em_divisao THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: extrato % está em uma divisão de conciliação; use fin_desconciliar na transação', p_extrato_id;
  END IF;

  UPDATE public.extratos_bancarios
     SET reconciliado = p_ignorado
   WHERE id = p_extrato_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_marcar_extrato_ignorado', 'extratos_bancarios', p_extrato_id,
    jsonb_build_object('ignorado', p_ignorado),
    NULL);

  RETURN jsonb_build_object('ok', true, 'id', p_extrato_id, 'reconciliado', p_ignorado);
END;
$$;

COMMENT ON FUNCTION public.fin_marcar_extrato_ignorado(uuid, boolean, jsonb) IS
  'Alterna extratos_bancarios.reconciliado para um extrato SEM vínculo de conciliação (F7) — "ignorar"/"reativar" ruído do extrato. Recusa extrato vinculado (1:1/lote/divisão); use fin_desconciliar nesses casos.';

GRANT EXECUTE ON FUNCTION public.fin_marcar_extrato_ignorado(uuid, boolean, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_marcar_extrato_ignorado(uuid, boolean, jsonb) FROM anon;
