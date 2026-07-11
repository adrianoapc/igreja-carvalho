-- ============================================================================
-- F1.5 — Ofertas e reembolso no CORE (ADR-029)
--
-- · fin_lancar_sessao: substitui os 3 inserts diretos do RelatorioOferta.
--   Resolve conta por forma_pagamento_contas, status por formas_pagamento.
--   gera_pago e taxa pela forma; cria todas as transações com sessao_id e
--   finaliza a sessão numa única transação.
-- · fin_pagar_reembolso: transação de caixa (ADR-001) + status da solicitação
--   + notificação ao solicitante, atômico. Decisão D9: pagar/aprovar exige
--   admin OU tesoureiro (o trigger validar_status_reembolso é alinhado à UI,
--   que já liberava tesoureiro; antes o trigger exigia admin e quebraria em
--   runtime).
--
-- Observações de saneamento (D8):
-- · O CHECK de sessoes_contagem já inclui 'finalizado' e a coluna
--   data_fechamento existe (migration 20260209211530).
-- · open_sessao_contagem foi unificada na migration 20260209211726 (versão
--   única de 5 parâmetros lendo configuracoes_financeiro); a versão antiga
--   que lia financeiro_config foi dropada lá.
-- ============================================================================

-- ─── 1. Trigger de reembolso alinhado à D9 (admin OU tesoureiro) ────────────

CREATE OR REPLACE FUNCTION public.validar_status_reembolso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('aprovado', 'pago', 'rejeitado') AND OLD.status != NEW.status THEN
    -- D9: admin OU tesoureiro. Chamadas via RPC fin_* com service role
    -- (bot/edge) sinalizam pelo GUC fin.rpc — a RPC já validou o ator.
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'tesoureiro'::app_role)
      OR COALESCE(current_setting('fin.rpc', true), '') <> ''
    ) THEN
      RAISE EXCEPTION 'Apenas admin ou tesoureiro podem aprovar/pagar/rejeitar solicitações';
    END IF;
  END IF;

  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.data_pagamento IS NULL THEN
      NEW.data_pagamento = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 2. fin_lancar_sessao ───────────────────────────────────────────────────
-- p_itens: array de objetos
--   { forma_pagamento_id, valor, conta_id?, categoria_id?, descricao?,
--     pessoa_id?, origem_registro?, observacoes?, status?,
--     taxas_administrativas?, data_pagamento? }

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
      v_warnings := v_warnings || 'item com valor <= 0 ignorado';
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

-- ─── 3. fin_pagar_reembolso ─────────────────────────────────────────────────
-- p_dados: { data_pagamento?, forma_pagamento?, observacoes? }

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
    v_warnings := v_warnings || 'solicitante sem user_id; notificação não enviada';
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

-- ─── 4. Grants ──────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.fin_lancar_sessao(uuid, jsonb, boolean, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_pagar_reembolso(uuid, uuid, jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_lancar_sessao(uuid, jsonb, boolean, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_pagar_reembolso(uuid, uuid, jsonb, jsonb) FROM anon;
