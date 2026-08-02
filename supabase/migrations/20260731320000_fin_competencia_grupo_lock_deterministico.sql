-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 02/08 02:56, commit revisado
-- de4ba627), real:
--
-- fin_alterar_competencia_grupo travava `p_lancamento_id` INDIVIDUALMENTE
-- (`SELECT ... WHERE id = p_lancamento_id FOR UPDATE`) numa statement, e SÓ
-- DEPOIS travava o grupo inteiro (`WHERE id = v_pai OR lancamento_pai_id =
-- v_pai FOR UPDATE`) numa segunda statement. Duas sessões sincronizando
-- parcelas DIFERENTES do MESMO grupo concorrentemente (ex.: A edita a
-- parcela 2, B edita a parcela 3) deadlockavam: A trava a parcela 2
-- primeiro, B trava a parcela 3 primeiro — depois A tenta travar o grupo
-- inteiro (que inclui a parcela 3, já travada por B) e espera; B tenta
-- travar o grupo inteiro (que inclui a parcela 2, já travada por A) e
-- espera — espera circular, Postgres aborta uma das duas (achado do
-- /code-review).
--
-- Fix: nunca trava uma linha individual isolada ANTES do lock do grupo —
-- resolve a raiz do grupo (`v_pai`) com um SELECT sem lock primeiro (só
-- precisa saber QUAL grupo travar), depois trava TODO o grupo numa ÚNICA
-- statement, em ordem determinística (`ORDER BY id`) — mesmo padrão já
-- usado em `fin_criar_transferencia` e `atualizar_saldo_conta_lote` pra
-- evitar exatamente essa classe de deadlock. `v_atual` é relido DEPOIS do
-- lock do grupo, com snapshot fresco (READ COMMITTED: nova statement pega
-- snapshot novo).
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

  -- Só pra achar QUAL grupo travar — sem lock aqui. Travar p_lancamento_id
  -- sozinho nesta statement, antes do lock do grupo abaixo, é exatamente
  -- o que causava o deadlock (achado do /code-review).
  SELECT COALESCE(lancamento_pai_id, id) INTO v_pai
    FROM public.transacoes_financeiras
   WHERE id = p_lancamento_id AND igreja_id = v_igreja;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_lancamento_id;
  END IF;

  -- Trava o grupo INTEIRO numa única statement, ordem determinística (por
  -- id) — único ponto de lock desta função.
  PERFORM 1 FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja AND (id = v_pai OR lancamento_pai_id = v_pai)
   ORDER BY id
     FOR UPDATE;

  -- Relê v_atual DEPOIS do lock do grupo — snapshot fresco (READ
  -- COMMITTED: statement nova), garante que a linha ainda existe e ainda
  -- pertence ao grupo travado.
  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_lancamento_id AND igreja_id = v_igreja;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_lancamento_id;
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
