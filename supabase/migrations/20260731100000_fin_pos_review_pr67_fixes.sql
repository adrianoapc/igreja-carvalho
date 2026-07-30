-- ============================================================================
-- Fixes pós-review (Codex, PR #67) — 3 achados reais confirmados por leitura
-- direta do código (outros 3 achados do mesmo review já estavam corrigidos
-- por commits anteriores desta mesma PR, achados stale, sem ação aqui).
--
-- 1) Trigger de saldo (atualizar_saldo_conta) só dispara em AFTER UPDATE OF
--    status — nunca em INSERT. Qualquer RPC que crie um lançamento já
--    'pago' direto (sem passar por pendente→pago) nunca move
--    contas.saldo_atual:
--      · fin_lancar_sessao — toda oferta com forma_pagamento.gera_pago=true
--        (PIX/Cartão, o caminho mais comum do Relatório de Ofertas).
--      · fin_pagar_reembolso — todo pagamento de reembolso.
--      · fin_lancar_desagio_antecipacao (Fase B desta PR, achado original
--        do Codex) — toda saída de deságio lançada.
--    fin_criar_transferencia já sabia disso e compensava com um UPDATE
--    manual de saldo_atual logo após os 2 INSERTs — se o trigger passar a
--    cobrir INSERT, essa compensação duplicaria o movimento (saldo mexendo
--    2x pro mesmo valor). Fix: trigger cobre INSERT E UPDATE OF status;
--    fin_criar_transferencia perde a compensação manual, vira só mais um
--    caller do executor único.
--
-- 2) fin_vincular_lote_antecipacao não validava que o extrato bancário
--    pertence à mesma filial do lote — na visão "todas as filiais",
--    permitia vincular o lote de uma filial a um crédito de outra.
--
-- 3) fin_lancar_desagio_antecipacao não validava que a conta escolhida
--    pertence à mesma filial do lote — mesmo problema, na escolha de conta.
-- ============================================================================

-- ─── 1a. atualizar_saldo_conta cobre INSERT também ─────────────────────────

CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pago' THEN
      IF NEW.tipo = 'entrada' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
         WHERE id = NEW.conta_id;
      ELSIF NEW.tipo = 'saida' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
         WHERE id = NEW.conta_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' (só dispara em UPDATE OF status, ver CREATE TRIGGER abaixo)
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_atualizar_saldo_conta ON public.transacoes_financeiras;
CREATE TRIGGER trigger_atualizar_saldo_conta
  AFTER INSERT OR UPDATE OF status ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_conta();

-- ─── 1b. fin_criar_transferencia perde a compensação manual duplicada ──────

CREATE OR REPLACE FUNCTION public.fin_criar_transferencia(
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor numeric,
  p_data date,
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
  v_filial uuid;
  v_transf uuid;
  v_tx_saida uuid;
  v_tx_entrada uuid;
  v_nome_origem text;
  v_nome_destino text;
  v_forma_transf_id uuid;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: valor deve ser positivo';
  END IF;
  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: contas de origem e destino devem ser diferentes';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, 'autorizado_lancar_depositos');
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;
  IF p_extras ? 'filial_id' THEN
    v_filial := NULLIF(p_extras ->> 'filial_id', '')::uuid;
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_origem_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('contas', p_conta_destino_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_saida_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid, v_igreja);

  SELECT nome INTO v_nome_origem FROM public.contas WHERE id = p_conta_origem_id;
  SELECT nome INTO v_nome_destino FROM public.contas WHERE id = p_conta_destino_id;

  SELECT id INTO v_forma_transf_id FROM public.formas_pagamento
   WHERE igreja_id = v_igreja AND nome = 'Transferência Bancária' AND ativo = true
   ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.transferencias_contas (
    conta_origem_id, conta_destino_id, valor,
    data_transferencia, data_competencia, observacoes, anexo_url,
    igreja_id, filial_id, status, criado_por, sessao_id
  ) VALUES (
    p_conta_origem_id, p_conta_destino_id, p_valor,
    p_data, p_data,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    v_igreja, v_filial, 'executada',
    COALESCE(NULLIF(p_extras ->> 'criado_por','')::uuid, (v_ctx ->> 'ator_profile_id')::uuid),
    NULLIF(p_extras ->> 'sessao_bot_id','')::uuid
  ) RETURNING id INTO v_transf;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor,
    data_vencimento, data_pagamento, data_competencia, status,
    forma_pagamento, forma_pagamento_id, conta_id, categoria_id, subcategoria_id,
    base_ministerial_id, centro_custo_id, transferencia_id,
    observacoes, anexo_url, lancado_por, igreja_id, filial_id
  ) VALUES (
    'saida', 'unico',
    COALESCE(NULLIF(p_extras ->> 'descricao_saida',''),
             'Transferência para ' || COALESCE(v_nome_destino, 'outra conta')),
    p_valor, p_data, p_data, p_data, 'pago',
    COALESCE(NULLIF(p_extras ->> 'forma_pagamento',''), 'Transferência Bancária'),
    v_forma_transf_id,
    p_conta_origem_id,
    NULLIF(p_extras ->> 'categoria_saida_id','')::uuid,
    NULLIF(p_extras ->> 'subcategoria_saida_id','')::uuid,
    NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
    NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
    v_transf,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    (v_ctx ->> 'ator_user_id')::uuid,
    v_igreja, v_filial
  ) RETURNING id INTO v_tx_saida;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor,
    data_vencimento, data_pagamento, data_competencia, status,
    forma_pagamento, forma_pagamento_id, conta_id, categoria_id,
    base_ministerial_id, centro_custo_id, transferencia_id,
    observacoes, anexo_url, lancado_por, igreja_id, filial_id
  ) VALUES (
    'entrada', 'unico',
    COALESCE(NULLIF(p_extras ->> 'descricao_entrada',''),
             'Transferência de ' || COALESCE(v_nome_origem, 'outra conta')),
    p_valor, p_data, p_data, p_data, 'pago',
    COALESCE(NULLIF(p_extras ->> 'forma_pagamento',''), 'Transferência Bancária'),
    v_forma_transf_id,
    p_conta_destino_id,
    NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid,
    NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
    NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
    v_transf,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    (v_ctx ->> 'ator_user_id')::uuid,
    v_igreja, v_filial
  ) RETURNING id INTO v_tx_entrada;

  UPDATE public.transferencias_contas
     SET transacao_saida_id = v_tx_saida,
         transacao_entrada_id = v_tx_entrada,
         updated_at = now()
   WHERE id = v_transf;

  -- Os 2 INSERTs acima (status='pago' direto) já movem saldo_atual das duas
  -- contas via trigger_atualizar_saldo_conta (agora também dispara em
  -- INSERT, não só em UPDATE OF status — ver acima). Compensação manual
  -- removida: mantê-la duplicaria o movimento.

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_criar_transferencia', 'transferencias_contas', v_transf,
    jsonb_build_object('conta_origem_id', p_conta_origem_id,
                       'conta_destino_id', p_conta_destino_id,
                       'valor', p_valor, 'data', p_data, 'extras', p_extras),
    jsonb_build_object('transacao_saida_id', v_tx_saida,
                       'transacao_entrada_id', v_tx_entrada));

  RETURN jsonb_build_object('ok', true, 'id', v_transf,
                            'transacao_saida_id', v_tx_saida,
                            'transacao_entrada_id', v_tx_entrada,
                            'warnings', '[]'::jsonb);
END;
$$;

-- ─── 2. fin_vincular_lote_antecipacao valida filial do extrato ────────────

CREATE OR REPLACE FUNCTION public.fin_vincular_lote_antecipacao(
  p_lote_id uuid,
  p_extrato_bancario_id uuid,
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
  v_lote public.getnet_antecipacao_lotes%ROWTYPE;
  v_extrato record;
  v_desagio numeric;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_lote FROM public.getnet_antecipacao_lotes
   WHERE id = p_lote_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lote % fora do tenant ou inexistente', p_lote_id;
  END IF;
  IF v_lote.status = 'lancamento_criado' THEN
    RAISE EXCEPTION 'FIN_JA_LANCADO: lote já tem deságio lançado (%); não é possível trocar o vínculo', v_lote.lancamento_desagio_id;
  END IF;

  SELECT id, igreja_id, filial_id, valor, data_transacao, tipo INTO v_extrato
    FROM public.extratos_bancarios WHERE id = p_extrato_bancario_id;
  IF v_extrato.id IS NULL OR v_extrato.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: extrato bancário inexistente ou fora do tenant';
  END IF;
  IF v_extrato.tipo <> 'credito' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário selecionado não é um crédito';
  END IF;
  -- Lote com filial definida só pode vincular a extrato da mesma filial
  -- (filial NULL no lote = lote global, aceita qualquer extrato do tenant).
  IF v_lote.filial_id IS NOT NULL
     AND v_extrato.filial_id IS DISTINCT FROM v_lote.filial_id THEN
    RAISE EXCEPTION 'FIN_TENANT: extrato bancário pertence a outra filial (lote é da filial %)', v_lote.filial_id;
  END IF;

  -- Mesma linha de extrato não pode virar antecipação de dois lotes diferentes.
  IF EXISTS (
    SELECT 1 FROM public.getnet_antecipacao_lotes
     WHERE extrato_bancario_id = p_extrato_bancario_id AND id <> p_lote_id
  ) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário já vinculado a outro lote de antecipação';
  END IF;

  UPDATE public.getnet_antecipacao_lotes
     SET extrato_bancario_id = p_extrato_bancario_id,
         status = 'vinculado',
         updated_at = now()
   WHERE id = p_lote_id;

  v_desagio := COALESCE(v_lote.valor_atual_contrato, 0) - v_extrato.valor;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_vincular_lote_antecipacao', 'getnet_antecipacao_lotes', p_lote_id,
    jsonb_build_object('extrato_bancario_id', p_extrato_bancario_id),
    jsonb_build_object('desagio', v_desagio, 'extrato_valor', v_extrato.valor,
                       'extrato_data', v_extrato.data_transacao));

  RETURN jsonb_build_object('ok', true, 'id', p_lote_id,
                            'desagio', v_desagio,
                            'warnings', '[]'::jsonb);
END;
$$;

-- ─── 3. fin_lancar_desagio_antecipacao valida filial da conta ─────────────

CREATE OR REPLACE FUNCTION public.fin_lancar_desagio_antecipacao(
  p_lote_id uuid,
  p_categoria_id uuid,
  p_conta_id uuid,
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
  v_lote public.getnet_antecipacao_lotes%ROWTYPE;
  v_extrato record;
  v_categoria record;
  v_conta_filial uuid;
  v_desagio numeric;
  v_res jsonb;
  v_lancamento_id uuid;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, 'autorizado_lancar_despesas');
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_lote FROM public.getnet_antecipacao_lotes
   WHERE id = p_lote_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lote % fora do tenant ou inexistente', p_lote_id;
  END IF;
  IF v_lote.lancamento_desagio_id IS NOT NULL THEN
    RAISE EXCEPTION 'FIN_JA_LANCADO: deságio já lançado pro lote % (lancamento_id=%)', p_lote_id, v_lote.lancamento_desagio_id;
  END IF;
  IF v_lote.status <> 'vinculado' OR v_lote.extrato_bancario_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lote precisa estar vinculado a um extrato antes de lançar o deságio';
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', p_categoria_id, v_igreja);

  -- Mesma regra de filial do vínculo com o extrato (lote com filial definida
  -- só aceita conta da mesma filial; filial NULL na conta = conta global).
  IF v_lote.filial_id IS NOT NULL THEN
    SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;
    IF v_conta_filial IS NOT NULL AND v_conta_filial IS DISTINCT FROM v_lote.filial_id THEN
      RAISE EXCEPTION 'FIN_TENANT: conta selecionada pertence a outra filial (lote é da filial %)', v_lote.filial_id;
    END IF;
  END IF;

  SELECT tipo INTO v_categoria FROM public.categorias_financeiras WHERE id = p_categoria_id;
  IF v_categoria.tipo <> 'saida' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: categoria informada não é de saída';
  END IF;

  SELECT id, valor, data_transacao INTO v_extrato
    FROM public.extratos_bancarios WHERE id = v_lote.extrato_bancario_id;
  IF v_extrato.id IS NULL THEN
    RAISE EXCEPTION 'FIN_FK: extrato bancário vinculado ao lote não encontrado';
  END IF;

  v_desagio := COALESCE(v_lote.valor_atual_contrato, 0) - v_extrato.valor;
  IF v_desagio <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: deságio calculado (%) não é positivo — confira o vínculo com o extrato', v_desagio;
  END IF;

  v_res := public.fin_criar_lancamento(
    'saida',
    v_desagio,
    v_extrato.data_transacao,
    p_conta_id,
    format('Deságio de antecipação Getnet — Contrato %s', v_lote.contrato_registradora),
    p_categoria_id,
    jsonb_build_object(
      'status', 'pago',
      'data_pagamento', v_extrato.data_transacao,
      'data_competencia', v_extrato.data_transacao,
      'origem_registro', 'getnet_antecipacao_desagio',
      'filial_id', v_lote.filial_id
    ),
    NULL
  );
  v_lancamento_id := (v_res ->> 'id')::uuid;

  UPDATE public.getnet_antecipacao_lotes
     SET lancamento_desagio_id = v_lancamento_id,
         status = 'lancamento_criado',
         updated_at = now()
   WHERE id = p_lote_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_lancar_desagio_antecipacao', 'getnet_antecipacao_lotes', p_lote_id,
    jsonb_build_object('categoria_id', p_categoria_id, 'conta_id', p_conta_id),
    jsonb_build_object('lancamento_id', v_lancamento_id, 'desagio', v_desagio));

  RETURN jsonb_build_object('ok', true, 'id', p_lote_id,
                            'lancamento_id', v_lancamento_id,
                            'desagio', v_desagio,
                            'warnings', '[]'::jsonb);
END;
$$;
