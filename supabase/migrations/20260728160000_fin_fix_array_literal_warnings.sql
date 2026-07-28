-- ============================================================================
-- Fix: "malformed array literal" (SQLSTATE 22P02) ao concatenar string
-- literal direto num text[] via ||
--
-- Achado em produção: excluir um lançamento com status='pago' sempre falhava
-- com "malformed array literal: 'lançamento pago excluído; ...'". Causa:
-- `v_warnings text[] || 'string sem cast'` é ambíguo pro Postgres entre
-- array_cat(anyarray,anyarray) e array_append(anyarray,anyelement) — com um
-- literal de tipo "unknown" ele tenta resolver como array_cat, ou seja,
-- tenta fazer PARSE da string como literal de array (que precisa começar
-- com "{"), e falha. Reproduzido isoladamente:
--
--   DO $$ DECLARE v text[] := '{}'; BEGIN
--     v := v || 'string sem chave'; -- ERRO: malformed array literal
--   END $$;
--
-- Fix: cast explícito ::text no literal (desambigua pra array_append).
-- Confirmado por grep que os outros usos de `v_warnings || ...` no schema
-- (format(...), left(SQLERRM,...)) já retornam `text` explicitamente e por
-- isso nunca tiveram esse problema — só os 4 casos abaixo, com literal cru,
-- estavam expostos. Todas as 4 funções são substituídas via CREATE OR
-- REPLACE, sem qualquer outra mudança de comportamento.
-- ============================================================================

-- ─── 1. fin_atualizar_lancamento (só o comentário de contexto; sem bug — usa
--        format(), mantido por completude do CREATE OR REPLACE)  ────────────
-- (não precisa ser recriada — não tem o bug; omitida de propósito)

-- ─── 2. fin_alterar_status_lancamento ──────────────────────────────────────

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
        + COALESCE((p_dados ->> 'taxas_administrativas')::numeric, taxas_administrativas, 0)
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

-- ─── 3. fin_excluir_lancamento ──────────────────────────────────────────────

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

  IF v_atual.status = 'pago' THEN
    v_warnings := v_warnings ||
      'lançamento pago excluído; saldo da conta não é recalculado automaticamente (use fin_recalcular_saldo_conta se necessário)'::text;
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

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_excluir_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('escopo', v_escopo,
                       'snapshot', to_jsonb(v_atual)),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 4. fin_lancar_sessao ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_lancar_sessao(
  p_sessao_id uuid,
  p_itens jsonb,
  p_finalizar boolean DEFAULT true,
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
  v_sessao public.sessoes_contagem%ROWTYPE;
  v_item jsonb;
  v_forma record;
  v_conta uuid;
  v_status text;
  v_taxas numeric;
  v_valor numeric;
  v_data date;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_warnings text[] := '{}';
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_itens deve ser um array não-vazio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, 'autorizado_lancar_depositos');
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_sessao FROM public.sessoes_contagem
   WHERE id = p_sessao_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: sessão % fora do tenant ou inexistente', p_sessao_id;
  END IF;
  IF v_sessao.status IN ('cancelado', 'finalizado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: sessão com status % não aceita lançamentos', v_sessao.status;
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_itens) LOOP
    v_valor := (v_item ->> 'valor')::numeric;
    IF v_valor IS NULL OR v_valor <= 0 THEN
      v_warnings := v_warnings || 'item com valor <= 0 ignorado'::text;
      CONTINUE;
    END IF;

    SELECT id, nome, is_digital, gera_pago, taxa_administrativa, taxa_administrativa_fixa
      INTO v_forma
      FROM public.formas_pagamento
     WHERE id = (v_item ->> 'forma_pagamento_id')::uuid AND igreja_id = v_igreja;
    IF v_forma.id IS NULL THEN
      RAISE EXCEPTION 'FIN_FK: forma_pagamento % inexistente ou fora do tenant',
        v_item ->> 'forma_pagamento_id';
    END IF;

    -- Conta: explícita no item ou mapeamento forma_pagamento_contas.
    v_conta := NULLIF(v_item ->> 'conta_id', '')::uuid;
    IF v_conta IS NULL THEN
      SELECT conta_id INTO v_conta
        FROM public.forma_pagamento_contas
       WHERE forma_pagamento_id = v_forma.id AND igreja_id = v_igreja
       ORDER BY prioridade NULLS LAST
       LIMIT 1;
    END IF;
    IF v_conta IS NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: forma "%" não está mapeada para uma conta (Finanças → Formas de Pagamento)',
        v_forma.nome;
    END IF;
    PERFORM public.fin_validar_fk_tenant('contas', v_conta, v_igreja);

    -- Status pela forma (gera_pago), salvo override do item.
    v_status := COALESCE(NULLIF(v_item ->> 'status', ''),
                         CASE WHEN COALESCE(v_forma.gera_pago, false) THEN 'pago' ELSE 'pendente' END);

    -- Taxa administrativa: item > cálculo pela forma (% + fixa).
    IF v_item ? 'taxas_administrativas' THEN
      v_taxas := (v_item ->> 'taxas_administrativas')::numeric;
    ELSE
      v_taxas := NULL;
      IF COALESCE(v_forma.taxa_administrativa, 0) > 0 THEN
        v_taxas := v_valor * (v_forma.taxa_administrativa / 100.0);
      END IF;
      IF COALESCE(v_forma.taxa_administrativa_fixa, 0) > 0 THEN
        v_taxas := COALESCE(v_taxas, 0) + v_forma.taxa_administrativa_fixa;
      END IF;
    END IF;

    v_data := v_sessao.data_culto;

    INSERT INTO public.transacoes_financeiras (
      tipo, tipo_lancamento, descricao, valor, valor_liquido,
      data_vencimento, data_competencia, data_pagamento, status,
      conta_id, categoria_id, forma_pagamento, taxas_administrativas,
      observacoes, lancado_por, pessoa_id, origem_registro,
      sessao_id, igreja_id, filial_id
    ) VALUES (
      'entrada', 'unico',
      COALESCE(NULLIF(v_item ->> 'descricao', ''),
               (CASE WHEN v_forma.is_digital THEN 'Digital' ELSE 'Físico' END)
                 || ' (' || v_forma.nome || ') - Oferta - Culto '
                 || to_char(v_sessao.data_culto, 'DD/MM/YYYY')),
      v_valor,
      v_valor + COALESCE(v_taxas, 0),
      v_data, v_data,
      CASE WHEN v_status = 'pago'
           THEN COALESCE(NULLIF(v_item ->> 'data_pagamento', '')::date, v_data)
           ELSE NULL END,
      v_status,
      v_conta,
      NULLIF(v_item ->> 'categoria_id', '')::uuid,
      v_forma.id::text,
      v_taxas,
      NULLIF(v_item ->> 'observacoes', ''),
      (v_ctx ->> 'ator_user_id')::uuid,
      NULLIF(v_item ->> 'pessoa_id', '')::uuid,
      COALESCE(NULLIF(v_item ->> 'origem_registro', ''), 'manual'),
      p_sessao_id, v_igreja, v_sessao.filial_id
    ) RETURNING id INTO v_id;

    v_ids := v_ids || v_id;
  END LOOP;

  IF array_length(v_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: nenhum item válido para lançar';
  END IF;

  IF p_finalizar THEN
    DELETE FROM public.sessoes_itens_draft WHERE sessao_id = p_sessao_id;
    UPDATE public.sessoes_contagem
       SET status = 'finalizado', data_fechamento = now(), updated_at = now()
     WHERE id = p_sessao_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_lancar_sessao', 'sessoes_contagem', p_sessao_id,
    jsonb_build_object('itens', p_itens, 'finalizar', p_finalizar),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids),
                            'sessao_id', p_sessao_id,
                            'finalizada', p_finalizar,
                            'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 5. fin_pagar_reembolso ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_pagar_reembolso(
  p_solicitacao_id uuid,
  p_conta_id uuid,
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
  v_sol public.solicitacoes_reembolso%ROWTYPE;
  v_solicitante record;
  v_data date;
  v_tx uuid;
  v_warnings text[] := '{}';
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, 'autorizado_lancar_reembolsos');
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_sol FROM public.solicitacoes_reembolso
   WHERE id = p_solicitacao_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: solicitação % fora do tenant ou inexistente', p_solicitacao_id;
  END IF;
  IF v_sol.status NOT IN ('pendente', 'aprovado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: solicitação com status % não pode ser paga', v_sol.status;
  END IF;
  IF COALESCE(v_sol.valor_total, 0) <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: solicitação sem valor total';
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);

  SELECT nome, user_id INTO v_solicitante
    FROM public.profiles WHERE id = v_sol.solicitante_id;

  v_data := COALESCE(NULLIF(p_dados ->> 'data_pagamento', '')::date, CURRENT_DATE);

  -- Sinaliza para o trigger validar_status_reembolso que a mudança de status
  -- vem de uma RPC fin_* (necessário quando auth.uid() é NULL — bot/edge).
  PERFORM set_config('fin.rpc', 'fin_pagar_reembolso', true);

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor, valor_liquido,
    data_vencimento, data_pagamento, data_competencia, status,
    conta_id, forma_pagamento, solicitacao_reembolso_id,
    observacoes, lancado_por, origem_registro, igreja_id, filial_id
  ) VALUES (
    'saida', 'unico',
    'Reembolso - ' || COALESCE(v_solicitante.nome, 'Solicitante'),
    v_sol.valor_total, v_sol.valor_total,
    COALESCE(v_sol.data_vencimento, v_data), v_data, v_data, 'pago',
    p_conta_id,
    COALESCE(NULLIF(p_dados ->> 'forma_pagamento', ''),
             v_sol.forma_pagamento_preferida, 'pix'),
    p_solicitacao_id,
    COALESCE(NULLIF(p_dados ->> 'observacoes', ''),
             'Pagamento de reembolso #' || upper(left(p_solicitacao_id::text, 8))),
    (v_ctx ->> 'ator_user_id')::uuid,
    'manual', v_igreja, v_sol.filial_id
  ) RETURNING id INTO v_tx;

  UPDATE public.solicitacoes_reembolso
     SET status = 'pago',
         data_pagamento = v_data,
         updated_at = now()
   WHERE id = p_solicitacao_id;

  -- Notificação unificada UI×bot: solicitante é avisado do pagamento.
  IF v_solicitante.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, igreja_id, filial_id, metadata)
    VALUES (
      v_solicitante.user_id,
      'Reembolso pago',
      'Seu reembolso #' || upper(left(p_solicitacao_id::text, 8))
        || ' no valor de R$ ' || to_char(v_sol.valor_total, 'FM999G999G990D00')
        || ' foi pago em ' || to_char(v_data, 'DD/MM/YYYY') || '.',
      'financeiro_reembolso_pago',
      v_igreja, v_sol.filial_id,
      jsonb_build_object('solicitacao_id', p_solicitacao_id, 'transacao_id', v_tx)
    );
  ELSE
    v_warnings := v_warnings || 'solicitante sem user_id; notificação não enviada'::text;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_pagar_reembolso', 'solicitacoes_reembolso', p_solicitacao_id,
    jsonb_build_object('conta_id', p_conta_id, 'dados', p_dados),
    jsonb_build_object('transacao_id', v_tx));

  RETURN jsonb_build_object('ok', true, 'id', p_solicitacao_id,
                            'transacao_id', v_tx,
                            'warnings', to_jsonb(v_warnings));
END;
$$;
