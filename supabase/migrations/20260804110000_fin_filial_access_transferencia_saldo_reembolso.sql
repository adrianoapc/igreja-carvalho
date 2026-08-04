-- ============================================================================
-- has_filial_access em fin_estornar_transferencia, fin_ajustar_saldo e
-- fin_pagar_reembolso (docs/arquitetura-financeiro.md §11).
--
-- fin_estornar_transferencia: só validava tenant da transferência. Fix
-- espelha fin_criar_transferencia (PR #67, §9.74) — checa a filial da
-- própria transferência E das 2 contas envolvidas (origem/destino): estornar
-- exige pelo menos o mesmo acesso que criar.
--
-- fin_ajustar_saldo: 2 bugs. (a) zero has_filial_access. (b) a filial_id
-- GRAVADA na transação de ajuste vinha de v_ctx->>'filial_id' (contexto do
-- CHAMADOR), nunca da filial REAL da conta (p_conta_id, nunca lida do
-- banco) — corrigido pra ler contas.filial_id e usar esse valor tanto no
-- check quanto na gravação.
--
-- fin_pagar_reembolso: mesma forma dupla. (a) v_sol.filial_id (filial da
-- solicitação) já era lida mas nunca checada. (b) p_conta_id (de onde sai o
-- reembolso) só validava tenant, nunca filial — mesmo fix de ler contas.
-- filial_id e checar. Sem o agravante do (b) do ajuste: a transação já
-- gravava v_sol.filial_id (fonte correta), só faltava bloquear o acesso.
--
-- Testado em harness Postgres standalone (postgres:15, isolado): 13
-- cenários (4 transferência incl. caso "só a conta origem é de fora" / 4
-- ajuste incl. confirmação de que a filial gravada é a da CONTA não a do
-- contexto / 4 reembolso incl. bloqueio quando só a conta é de outra
-- filial + 1 dedicado ao bug de gravação), todos verdes, sem regressão nos
-- 16 cenários da migration anterior (has_filial_access nas 4 RPCs
-- triviais).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_estornar_transferencia(
  p_transferencia_id uuid,
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
  v_transf public.transferencias_contas%ROWTYPE;
  v_conta_origem_filial uuid;
  v_conta_destino_filial uuid;
  v_warnings text[] := '{}';
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_transf FROM public.transferencias_contas
   WHERE id = p_transferencia_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: transferência % fora do tenant ou inexistente', p_transferencia_id;
  END IF;

  -- Espelha fin_criar_transferencia (§9.74): filial da própria transferência
  -- + filial das 2 contas envolvidas — estornar exige o mesmo acesso que
  -- criar, não só a filial "de rótulo" da transferência.
  IF NOT public.has_filial_access(v_igreja, v_transf.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial desta transferência';
  END IF;
  SELECT filial_id INTO v_conta_origem_filial FROM public.contas WHERE id = v_transf.conta_origem_id;
  SELECT filial_id INTO v_conta_destino_filial FROM public.contas WHERE id = v_transf.conta_destino_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_origem_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta de origem';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_conta_destino_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta de destino';
  END IF;

  IF v_transf.status = 'estornada' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: transferência já estornada';
  END IF;

  -- Bloqueia estorno se alguma perna estiver conciliada (D4).
  IF EXISTS (
    SELECT 1 FROM public.transacoes_financeiras
     WHERE transferencia_id = p_transferencia_id
       AND conciliacao_status IN ('conciliado_extrato','conciliado_bot')
  ) THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: transferência com perna conciliada não pode ser estornada (D4)';
  END IF;

  -- pago → cancelado dispara o trigger de saldo (reversão única e correta).
  UPDATE public.transacoes_financeiras
     SET status = 'cancelado', updated_at = now()
   WHERE transferencia_id = p_transferencia_id
     AND status = 'pago';

  UPDATE public.transferencias_contas
     SET status = 'estornada', updated_at = now()
   WHERE id = p_transferencia_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_estornar_transferencia', 'transferencias_contas', p_transferencia_id,
    NULL,
    jsonb_build_object('transacao_saida_id', v_transf.transacao_saida_id,
                       'transacao_entrada_id', v_transf.transacao_entrada_id));

  RETURN jsonb_build_object('ok', true, 'id', p_transferencia_id,
                            'warnings', to_jsonb(v_warnings));
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_ajustar_saldo(
  p_conta_id uuid,
  p_valor numeric,
  p_tipo text,               -- entrada | saida
  p_motivo text DEFAULT NULL,
  p_data date DEFAULT CURRENT_DATE,
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
  v_conta_filial uuid;
  v_categoria uuid;
  v_id uuid;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: valor deve ser positivo';
  END IF;
  IF p_tipo NOT IN ('entrada','saida') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: tipo deve ser entrada|saida';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);

  -- Filial REAL da conta (lida do banco), não a do contexto do chamador —
  -- usada tanto pro check de acesso quanto pra gravar a transação de
  -- ajuste com a filial certa (antes vinha de v_ctx->>'filial_id', que o
  -- chamador controla e podia divergir da conta de verdade).
  SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta selecionada';
  END IF;

  -- Categoria dedicada por igreja/tipo (criada sob demanda).
  SELECT id INTO v_categoria FROM public.categorias_financeiras
   WHERE igreja_id = v_igreja AND nome = 'Ajuste de Saldo' AND tipo = p_tipo
   LIMIT 1;
  IF v_categoria IS NULL THEN
    INSERT INTO public.categorias_financeiras (nome, tipo, igreja_id, filial_id)
    VALUES ('Ajuste de Saldo', p_tipo, v_igreja, NULL)
    RETURNING id INTO v_categoria;
  END IF;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor, valor_liquido,
    data_vencimento, data_competencia, status,
    conta_id, categoria_id, observacoes, lancado_por,
    origem_registro, igreja_id, filial_id
  ) VALUES (
    p_tipo, 'unico',
    'Ajuste de saldo' || COALESCE(' — ' || NULLIF(p_motivo, ''), ''),
    p_valor, p_valor,
    p_data, p_data, 'pendente',
    p_conta_id, v_categoria,
    NULLIF(p_motivo, ''),
    (v_ctx ->> 'ator_user_id')::uuid,
    'ajuste', v_igreja, v_conta_filial
  ) RETURNING id INTO v_id;

  -- pendente → pago move o saldo via trigger (executor único).
  UPDATE public.transacoes_financeiras
     SET status = 'pago', data_pagamento = p_data, updated_at = now()
   WHERE id = v_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_ajustar_saldo', 'contas', p_conta_id,
    jsonb_build_object('valor', p_valor, 'tipo', p_tipo,
                       'motivo', p_motivo, 'data', p_data),
    jsonb_build_object('transacao_id', v_id));

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'warnings', '[]'::jsonb);
END;
$$;

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
  v_conta_filial uuid;
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

  -- Filial da própria solicitação — já era lida (v_sol.filial_id, usada até
  -- pra gravar a transação e a notificação), só faltava o check.
  IF NOT public.has_filial_access(v_igreja, v_sol.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial desta solicitação';
  END IF;

  IF v_sol.status NOT IN ('pendente', 'aprovado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: solicitação com status % não pode ser paga', v_sol.status;
  END IF;
  IF COALESCE(v_sol.valor_total, 0) <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: solicitação sem valor total';
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);

  -- Filial da conta de onde sai o dinheiro — nunca era checada (só tenant).
  SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta selecionada';
  END IF;

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

COMMENT ON FUNCTION public.fin_estornar_transferencia(uuid, jsonb) IS
  'Estorna transferência (cancela as 2 pernas pagas). has_filial_access na transferência + 2 contas, espelhando fin_criar_transferencia (§11).';
COMMENT ON FUNCTION public.fin_ajustar_saldo(uuid, numeric, text, text, date, jsonb) IS
  'Cria transação de ajuste manual de saldo. has_filial_access + filial gravada corrigida pra vir da conta real, não do contexto do chamador (§11).';
COMMENT ON FUNCTION public.fin_pagar_reembolso(uuid, uuid, jsonb, jsonb) IS
  'Paga solicitação de reembolso. has_filial_access na solicitação + na conta pagadora (§11).';
