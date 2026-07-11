-- ============================================================================
-- F3 — Conciliação transacional (ADR-030)
--
-- Substitui a confirmação multi-tabela NÃO transacional do frontend
-- (`ConciliacaoInteligente.tsx:421-703`, ~6 updates sequenciais) por UMA
-- transação no banco. Um contrato único cobre os três formatos de vínculo:
--   · 1:1  — 1 extrato ↔ 1 transação (extratos_bancarios.transacao_vinculada_id)
--   · N:1  — N extratos ↔ 1 transação (conciliacoes_lote + _extratos)
--   · 1:N  — 1 extrato ↔ N transações (conciliacoes_divisao + _transacoes)
--
-- `fin_confirmar_conciliacao(p_vinculo jsonb, p_contexto)` — porta única de
-- confirmação; `fin_desconciliar(p_transacao_id, p_contexto)` — inverso
-- (evolução transacional de `desconciliar_transacao`, já correta nos 3
-- vínculos; ganha contexto/auditoria fin_*).
--
-- Semântica preservada (paridade com o frontend atual):
--   · extrato → reconciliado=true (+ transacao_vinculada_id no 1:1);
--   · transação → conciliacao_status='conciliado_extrato';
--   · pendente → pago com data_pagamento = data do extrato (o trigger de
--     saldo faz o movimento — nada de UPDATE manual em contas);
--   · transferência: a perna irmã é conciliada junto;
--   · auditoria em reconciliacao_audit_logs + conciliacao_ml_feedback (ML) +
--     fin_audit_log (trilha canônica ADR-029).
--
-- Desconciliar NÃO reverte pago→pendente (mantém o comportamento de
-- `desconciliar_transacao`): dinheiro que caiu continua pago; reconciliar de
-- novo é no-op de saldo (só flipa pendente→pago). Decisão consciente para
-- evitar swing de saldo indevido — documentada em arquitetura-financeiro §9.2.
--
-- Depende de F1 (fin_resolver_contexto, fin_audit_log, fin_validar_fk_tenant).
-- ============================================================================

-- ─── 1. fin_confirmar_conciliacao ───────────────────────────────────────────
-- p_vinculo:
--   { extrato_ids: uuid[], transacao_ids: uuid[],
--     divisoes?: [{transacao_id, valor}],   -- obrigatório no formato 1:N
--     sugestao_id?: uuid, score?: numeric }

CREATE OR REPLACE FUNCTION public.fin_confirmar_conciliacao(
  p_vinculo jsonb,
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
  v_extrato_ids uuid[];
  v_transacao_ids uuid[];
  v_tipo_match text;
  v_score numeric := NULLIF(p_vinculo ->> 'score', '')::numeric;
  v_sugestao_id uuid := NULLIF(p_vinculo ->> 'sugestao_id', '')::uuid;
  v_ext record;
  v_trx record;
  v_conta uuid;
  v_data_extrato date;
  v_novo_status text;
  v_lote_id uuid;
  v_divisao_id uuid;
  v_soma_divisao numeric;
  v_id uuid;
  v_warnings text[] := '{}';
BEGIN
  v_extrato_ids := ARRAY(SELECT jsonb_array_elements_text(p_vinculo -> 'extrato_ids'))::uuid[];
  v_transacao_ids := ARRAY(SELECT jsonb_array_elements_text(p_vinculo -> 'transacao_ids'))::uuid[];

  IF array_length(v_extrato_ids, 1) IS NULL OR array_length(v_transacao_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato_ids e transacao_ids são obrigatórios';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Trava e valida os extratos no tenant (mesma conta para todos).
  FOR v_ext IN
    SELECT id, conta_id, valor, data_transacao, reconciliado, igreja_id
      FROM public.extratos_bancarios
     WHERE id = ANY(v_extrato_ids)
     FOR UPDATE
  LOOP
    IF v_ext.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: extrato % fora do tenant', v_ext.id;
    END IF;
    IF v_ext.reconciliado THEN
      RAISE EXCEPTION 'FIN_CONCILIADO: extrato % já está conciliado', v_ext.id;
    END IF;
    v_conta := COALESCE(v_conta, v_ext.conta_id);
    v_data_extrato := COALESCE(v_data_extrato, v_ext.data_transacao);
  END LOOP;
  IF v_conta IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: nenhum extrato encontrado';
  END IF;

  -- Trava e valida as transações no tenant.
  PERFORM 1;
  FOR v_trx IN
    SELECT id, igreja_id, status, conciliacao_status, transferencia_id
      FROM public.transacoes_financeiras
     WHERE id = ANY(v_transacao_ids)
     FOR UPDATE
  LOOP
    IF v_trx.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: transação % fora do tenant', v_trx.id;
    END IF;
    IF v_trx.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
      RAISE EXCEPTION 'FIN_CONCILIADO: transação % já está conciliada', v_trx.id;
    END IF;
  END LOOP;

  -- Determina o formato pelo cardinalidade.
  IF array_length(v_extrato_ids, 1) = 1 AND array_length(v_transacao_ids, 1) = 1 THEN
    v_tipo_match := '1:1';
  ELSIF array_length(v_transacao_ids, 1) = 1 THEN
    v_tipo_match := 'N:1';   -- vários extratos, uma transação (lote)
  ELSIF array_length(v_extrato_ids, 1) = 1 THEN
    v_tipo_match := '1:N';   -- um extrato, várias transações (divisão)
  ELSE
    RAISE EXCEPTION 'FIN_VALIDACAO: N extratos × N transações não é suportado';
  END IF;

  -- ── Estruturas de vínculo por formato ──
  IF v_tipo_match = '1:1' THEN
    UPDATE public.extratos_bancarios
       SET reconciliado = true, transacao_vinculada_id = v_transacao_ids[1]
     WHERE id = v_extrato_ids[1];

  ELSIF v_tipo_match = 'N:1' THEN
    DECLARE
      v_valor_trx numeric := COALESCE((SELECT valor FROM public.transacoes_financeiras WHERE id = v_transacao_ids[1]), 0);
      v_soma_ext numeric := COALESCE((SELECT SUM(valor) FROM public.extratos_bancarios WHERE id = ANY(v_extrato_ids)), 0);
    BEGIN
      -- diferenca é GENERATED ALWAYS (valor_transacao - valor_extratos): não inserir.
      INSERT INTO public.conciliacoes_lote
        (transacao_id, igreja_id, filial_id, conta_id, valor_transacao, valor_extratos, status, created_by)
      VALUES (v_transacao_ids[1], v_igreja, NULLIF(v_ctx ->> 'filial_id','')::uuid, v_conta,
              v_valor_trx, v_soma_ext,
              -- preserva a distinção do fluxo antigo: balanceado × discrepância
              CASE WHEN abs(v_soma_ext - v_valor_trx) < 0.01 THEN 'conciliada' ELSE 'discrepancia' END,
              (v_ctx ->> 'ator_user_id')::uuid)
      RETURNING id INTO v_lote_id;

      IF abs(v_soma_ext - v_valor_trx) >= 0.01 THEN
        v_warnings := v_warnings ||
          format('lote com discrepância de %s (extratos %s × transação %s)',
                 to_char(abs(v_soma_ext - v_valor_trx), 'FM999G999G990D00'), v_soma_ext, v_valor_trx);
      END IF;
    END;

    INSERT INTO public.conciliacoes_lote_extratos (conciliacao_lote_id, extrato_id)
    SELECT v_lote_id, unnest(v_extrato_ids);

    UPDATE public.extratos_bancarios
       SET reconciliado = true
     WHERE id = ANY(v_extrato_ids);

  ELSE  -- 1:N (divisão)
    IF NOT (p_vinculo ? 'divisoes') THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: formato 1:N exige divisoes[{transacao_id, valor}]';
    END IF;
    SELECT COALESCE(SUM((d ->> 'valor')::numeric), 0)
      INTO v_soma_divisao
      FROM jsonb_array_elements(p_vinculo -> 'divisoes') d;

    INSERT INTO public.conciliacoes_divisao
      (extrato_id, igreja_id, filial_id, conta_id, valor_extrato, status, created_by)
    VALUES (v_extrato_ids[1], v_igreja, NULLIF(v_ctx ->> 'filial_id','')::uuid, v_conta,
            (SELECT valor FROM public.extratos_bancarios WHERE id = v_extrato_ids[1]),
            'confirmada', (v_ctx ->> 'ator_user_id')::uuid)
    RETURNING id INTO v_divisao_id;

    INSERT INTO public.conciliacoes_divisao_transacoes (conciliacao_divisao_id, transacao_id, valor)
    SELECT v_divisao_id, (d ->> 'transacao_id')::uuid, (d ->> 'valor')::numeric
      FROM jsonb_array_elements(p_vinculo -> 'divisoes') d;

    UPDATE public.extratos_bancarios
       SET reconciliado = true
     WHERE id = v_extrato_ids[1];
  END IF;

  -- ── Estado das transações: conciliado + baixa (pendente→pago) + irmã ──
  FOR v_trx IN
    SELECT id, status, transferencia_id
      FROM public.transacoes_financeiras
     WHERE id = ANY(v_transacao_ids)
  LOOP
    v_novo_status := CASE WHEN v_trx.status = 'pendente' THEN 'pago' ELSE v_trx.status END;

    UPDATE public.transacoes_financeiras
       SET conciliacao_status = 'conciliado_extrato',
           status = v_novo_status,
           data_pagamento = CASE WHEN v_trx.status = 'pendente' THEN v_data_extrato ELSE data_pagamento END,
           updated_at = now()
     WHERE id = v_trx.id;

    -- Perna irmã da transferência acompanha.
    IF v_trx.transferencia_id IS NOT NULL THEN
      UPDATE public.transacoes_financeiras
         SET conciliacao_status = 'conciliado_extrato',
             status = v_novo_status,
             data_pagamento = CASE WHEN status = 'pendente' THEN v_data_extrato ELSE data_pagamento END,
             updated_at = now()
       WHERE transferencia_id = v_trx.transferencia_id
         AND id <> v_trx.id;
    END IF;
  END LOOP;

  -- ── Auditoria (reconciliacao_audit_logs por par + ML feedback + fin_audit) ──
  -- tipo_reconciliacao restrito ao CHECK (automatica|manual|lote|desconciliacao);
  -- o formato fino (1:1/N:1/1:N) vai em metadata.tipo_match.
  INSERT INTO public.reconciliacao_audit_logs
    (extrato_id, transacao_id, conta_id, igreja_id, filial_id, acao,
     tipo_reconciliacao, score, valor_extrato, valor_transacao, diferenca,
     conciliacao_lote_id, usuario_id, metadata)
  SELECT e_id, t_id, v_conta, v_igreja, NULLIF(v_ctx ->> 'filial_id','')::uuid,
         'conciliacao',
         CASE WHEN v_tipo_match = 'N:1' THEN 'lote' ELSE 'manual' END,
         v_score,
         (SELECT valor FROM public.extratos_bancarios WHERE id = e_id),
         (SELECT valor FROM public.transacoes_financeiras WHERE id = t_id),
         NULL, v_lote_id, NULLIF(v_ctx ->> 'ator_profile_id','')::uuid,
         jsonb_build_object('tipo_match', v_tipo_match, 'canal', v_ctx ->> 'canal')
    FROM unnest(v_extrato_ids) e_id
    CROSS JOIN unnest(v_transacao_ids) t_id;

  IF NULLIF(v_ctx ->> 'ator_profile_id','') IS NOT NULL THEN
    INSERT INTO public.conciliacao_ml_feedback
      (igreja_id, filial_id, conta_id, tipo_match, extrato_ids, transacao_ids,
       acao, score, modelo_versao, usuario_id, sugestao_id, ajustes)
    VALUES (v_igreja, NULLIF(v_ctx ->> 'filial_id','')::uuid, v_conta, v_tipo_match,
            v_extrato_ids, v_transacao_ids, 'ajustada', COALESCE(v_score, 1.0), 'v1',
            (v_ctx ->> 'ator_profile_id')::uuid, v_sugestao_id,
            jsonb_build_object('via', 'fin_confirmar_conciliacao'));
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_confirmar_conciliacao', 'extratos_bancarios', v_extrato_ids[1],
    p_vinculo,
    jsonb_build_object('tipo_match', v_tipo_match,
                       'extrato_ids', to_jsonb(v_extrato_ids),
                       'transacao_ids', to_jsonb(v_transacao_ids)));

  RETURN jsonb_build_object('ok', true, 'tipo_match', v_tipo_match,
                            'extrato_ids', to_jsonb(v_extrato_ids),
                            'transacao_ids', to_jsonb(v_transacao_ids),
                            'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 2. fin_desconciliar ────────────────────────────────────────────────────
-- Inverso: limpa os 3 mecanismos de vínculo da transação e registra trilha.
-- Evolução transacional de desconciliar_transacao com contexto/auditoria fin_*.

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

-- ─── 3. Grants ──────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.fin_confirmar_conciliacao(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_desconciliar(uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_confirmar_conciliacao(jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_desconciliar(uuid, jsonb) FROM anon;
