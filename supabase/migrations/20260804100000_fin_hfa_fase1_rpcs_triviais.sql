-- ============================================================================
-- Fase 1 do plano "Fechar has_filial_access nas 7 RPCs + RLS de
-- extratos_bancarios": as 4 RPCs triviais (menor risco, sem recurso
-- secundário nem filial derivada de contexto).
--
--   1. fin_desconciliar
--   2. fin_alterar_status_lancamento
--   3. fin_alternar_conferencia_manual
--   4. fin_marcar_extrato_ignorado
--
-- Origem: backlog §11 / §9.68 — SECURITY DEFINER + GRANT authenticated
-- sem has_filial_access. A UI filtrava por filial; a RPC não. Um
-- tesoureiro restrito à filial B que soubesse o id conseguia operar
-- recurso da filial A.
--
-- Fix (mesmo padrão de fin_excluir_lancamento / fin_atualizar_lancamento):
--   IF NOT public.has_filial_access(v_igreja, <filial do recurso>) THEN
--     RAISE EXCEPTION 'FIN_TENANT: ...';
--   END IF;
-- logo após o SELECT ... FOR UPDATE, ANTES de qualquer validação de
-- negócio (FIN_CONCILIADO etc.) — evita vazar "já conciliado" pra quem
-- não tem acesso à filial.
--
-- Assinaturas inalteradas → ACL (GRANT/REVOKE) das migrations originais
-- permanece via CREATE OR REPLACE.
--
-- Fora de escopo desta migration (fases seguintes do plano):
--   Fase 2 — fin_estornar_transferencia, fin_ajustar_saldo
--   Fase 3 — RLS de extratos_bancarios
--   Fase 4 — fin_confirmar_conciliacao
-- ============================================================================

-- ─── 1. fin_desconciliar ────────────────────────────────────────────────────
-- Versão-base: 20260711140000_fin_conciliacao_transacional.sql

CREATE OR REPLACE FUNCTION public.fin_desconciliar(
  p_transacao_id uuid,
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
  v_trx record;
  v_ext_1a1 int := 0;
  v_ext_lote int := 0;
  v_ext_div int := 0;
  v_lotes int := 0;
  v_divisoes int := 0;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT id, igreja_id, filial_id, conciliacao_status
    INTO v_trx
    FROM public.transacoes_financeiras
   WHERE id = p_transacao_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: transação % fora do tenant ou inexistente', p_transacao_id;
  END IF;

  IF NOT public.has_filial_access(v_igreja, v_trx.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lançamento';
  END IF;

  -- 1:1
  UPDATE public.extratos_bancarios
     SET reconciliado = false, transacao_vinculada_id = NULL
   WHERE transacao_vinculada_id = p_transacao_id;
  GET DIAGNOSTICS v_ext_1a1 = ROW_COUNT;

  -- N:1 (lote)
  WITH lotes AS (SELECT id FROM public.conciliacoes_lote WHERE transacao_id = p_transacao_id),
  ext AS (
    UPDATE public.extratos_bancarios e SET reconciliado = false
      FROM public.conciliacoes_lote_extratos cle
      JOIN lotes l ON l.id = cle.conciliacao_lote_id
     WHERE e.id = cle.extrato_id
    RETURNING e.id
  )
  SELECT COUNT(*) INTO v_ext_lote FROM ext;

  DELETE FROM public.conciliacoes_lote_extratos
   WHERE conciliacao_lote_id IN (SELECT id FROM public.conciliacoes_lote WHERE transacao_id = p_transacao_id);
  DELETE FROM public.conciliacoes_lote WHERE transacao_id = p_transacao_id;
  GET DIAGNOSTICS v_lotes = ROW_COUNT;

  -- 1:N (divisão) — divisões onde a transação participa
  WITH divisoes AS (
    SELECT DISTINCT cd.id, cd.extrato_id
      FROM public.conciliacoes_divisao cd
      JOIN public.conciliacoes_divisao_transacoes cdt ON cdt.conciliacao_divisao_id = cd.id
     WHERE cdt.transacao_id = p_transacao_id
  ),
  ext AS (
    UPDATE public.extratos_bancarios e
       SET reconciliado = false, transacao_vinculada_id = NULL
      FROM divisoes d WHERE e.id = d.extrato_id
    RETURNING e.id
  ),
  outras AS (
    UPDATE public.transacoes_financeiras tf SET conciliacao_status = 'nao_conciliado'
      FROM public.conciliacoes_divisao_transacoes cdt
      JOIN divisoes d ON d.id = cdt.conciliacao_divisao_id
     WHERE tf.id = cdt.transacao_id AND tf.id <> p_transacao_id
    RETURNING tf.id
  )
  SELECT COUNT(*) INTO v_ext_div FROM ext;

  DELETE FROM public.conciliacoes_divisao_transacoes
   WHERE conciliacao_divisao_id IN (
     SELECT cd.id FROM public.conciliacoes_divisao cd
      JOIN public.conciliacoes_divisao_transacoes cdt ON cdt.conciliacao_divisao_id = cd.id
     WHERE cdt.transacao_id = p_transacao_id
   );
  WITH del AS (
    DELETE FROM public.conciliacoes_divisao cd
     WHERE NOT EXISTS (
       SELECT 1 FROM public.conciliacoes_divisao_transacoes cdt
        WHERE cdt.conciliacao_divisao_id = cd.id
     )
     AND cd.igreja_id = v_igreja
    RETURNING cd.id
  )
  SELECT COUNT(*) INTO v_divisoes FROM del;

  -- Transação de volta a não conciliada (mantém status pago/pendente — ver cabeçalho)
  UPDATE public.transacoes_financeiras
     SET conciliacao_status = 'nao_conciliado', conferido_manual = false, updated_at = now()
   WHERE id = p_transacao_id;

  INSERT INTO public.reconciliacao_audit_logs
    (transacao_id, extrato_id, acao, tipo_reconciliacao, igreja_id, filial_id, usuario_id, metadata)
  VALUES (p_transacao_id, NULL, 'desconciliacao', 'desconciliacao', v_igreja, v_trx.filial_id,
          NULLIF(v_ctx ->> 'ator_profile_id','')::uuid,
          jsonb_build_object('extratos_1a1', v_ext_1a1, 'extratos_lote', v_ext_lote,
                             'extratos_divisao', v_ext_div, 'lotes_removidos', v_lotes,
                             'divisoes_removidas', v_divisoes));

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_desconciliar', 'transacoes_financeiras', p_transacao_id, NULL,
    jsonb_build_object('extratos_1a1', v_ext_1a1, 'extratos_lote', v_ext_lote,
                       'extratos_divisao', v_ext_div, 'lotes_removidos', v_lotes,
                       'divisoes_removidas', v_divisoes));

  RETURN jsonb_build_object('ok', true, 'id', p_transacao_id,
                            'extratos_1a1', v_ext_1a1, 'extratos_lote', v_ext_lote,
                            'extratos_divisao', v_ext_div, 'lotes_removidos', v_lotes,
                            'divisoes_removidas', v_divisoes,
                            'warnings', '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.fin_desconciliar(uuid, jsonb) IS
  'Inverso de fin_confirmar_conciliacao: limpa 1:1/lote/divisão e audit. '
  'has_filial_access na filial da transação (Fase 1 HFA).';

-- ─── 2. fin_alterar_status_lancamento ───────────────────────────────────────
-- Versão-base: 20260728170000_fin_taxa_entrada_subtrai_liquido.sql

CREATE OR REPLACE FUNCTION public.fin_alterar_status_lancamento(
  p_id uuid,
  p_novo_status text,
  p_dados jsonb DEFAULT '{}'::jsonb,
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
  v_warnings text[] := '{}';
BEGIN
  IF p_novo_status NOT IN ('pendente','pago','cancelado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status deve ser pendente|pago|cancelado';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  IF NOT public.has_filial_access(v_igreja, v_atual.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lançamento';
  END IF;

  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: status de lançamento conciliado não pode mudar (D4); desconcilie antes';
  END IF;

  IF v_atual.status = p_novo_status THEN
    v_warnings := v_warnings || 'status já era o solicitado; nenhuma mudança'::text;
    RETURN jsonb_build_object('ok', true, 'id', p_id, 'warnings', to_jsonb(v_warnings));
  END IF;

  IF p_novo_status = 'pendente' THEN
    -- Paridade com ActionsMenu: voltar a pendente limpa dados de pagamento.
    UPDATE public.transacoes_financeiras SET
      status = 'pendente', data_pagamento = NULL,
      juros = 0, multas = 0, desconto = 0, taxas_administrativas = 0,
      updated_at = now()
    WHERE id = p_id;
  ELSIF p_novo_status = 'pago' THEN
    -- Taxa administrativa reduz o que se RECEBE (entrada) e aumenta o que
    -- se PAGA (saída) — tipo vem da própria linha (bare column no SET).
    UPDATE public.transacoes_financeiras SET
      status = 'pago',
      data_pagamento = COALESCE((p_dados ->> 'data_pagamento')::date, CURRENT_DATE),
      juros  = COALESCE((p_dados ->> 'juros')::numeric, juros, 0),
      multas = COALESCE((p_dados ->> 'multas')::numeric, multas, 0),
      desconto = COALESCE((p_dados ->> 'desconto')::numeric, desconto, 0),
      taxas_administrativas = COALESCE((p_dados ->> 'taxas_administrativas')::numeric, taxas_administrativas, 0),
      valor_liquido = valor
        + COALESCE((p_dados ->> 'juros')::numeric, juros, 0)
        + COALESCE((p_dados ->> 'multas')::numeric, multas, 0)
        + (CASE WHEN tipo = 'saida' THEN 1 ELSE -1 END)
          * COALESCE((p_dados ->> 'taxas_administrativas')::numeric, taxas_administrativas, 0)
        - COALESCE((p_dados ->> 'desconto')::numeric, desconto, 0),
      updated_at = now()
    WHERE id = p_id;
  ELSE
    UPDATE public.transacoes_financeiras SET
      status = 'cancelado', updated_at = now()
    WHERE id = p_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_alterar_status_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('de', v_atual.status, 'para', p_novo_status, 'dados', p_dados),
    NULL);

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'warnings', to_jsonb(v_warnings));
END;
$$;

COMMENT ON FUNCTION public.fin_alterar_status_lancamento(uuid, text, jsonb, jsonb) IS
  'Altera status pendente|pago|cancelado de um lançamento. '
  'has_filial_access na filial do lançamento (Fase 1 HFA).';

-- ─── 3. fin_alternar_conferencia_manual ─────────────────────────────────────
-- Versão-base: 20260713150000_fin_conferencia_manual_e_ignorar_extrato.sql

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

  IF NOT public.has_filial_access(v_igreja, v_atual.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lançamento';
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
  'Alterna conferido_manual + conciliacao_status (nao_conciliado<->conciliado_manual). '
  'has_filial_access na filial do lançamento (Fase 1 HFA). Sincroniza perna irmã. '
  'Bloqueia se já conciliado via extrato/bot (D4).';

-- ─── 4. fin_marcar_extrato_ignorado ─────────────────────────────────────────
-- Versão-base: 20260713150000_fin_conferencia_manual_e_ignorar_extrato.sql

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

  IF NOT public.has_filial_access(v_igreja, v_atual.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste extrato';
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
  'Alterna extratos_bancarios.reconciliado para extrato SEM vínculo (ignorar/reativar ruído). '
  'has_filial_access na filial do extrato (Fase 1 HFA). Recusa extrato vinculado.';
