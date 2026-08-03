-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 03/08 13:03, commit revisado
-- 10b811fc), P1, real:
--
-- `fin_atualizar_lancamento` só valida `conta_id` (no patch) com
-- `fin_validar_fk_tenant` — tenant, nunca filial. Um tesoureiro restrito à
-- filial B conseguia editar uma transação ACESSÍVEL (da própria filial B,
-- passa no `has_filial_access(v_atual.filial_id)` do topo da função) e
-- trocar `conta_id` pra uma conta da filial A — sem NUNCA ter acesso
-- checado contra a filial A. Pra transação paga, o trigger de saldo
-- (statement-level, sempre recalcula, dispara em qualquer UPDATE)
-- recalcula o saldo da conta NOVA (filial A) também — o chamador altera o
-- saldo de uma conta de outra filial, e a transação (ainda filial_id=B)
-- passa a referenciar uma conta de filial diferente da sua própria,
-- divergência que nenhuma trigger detecta depois.
--
-- O comentário original desta função (§9.74, ver histórico) já registrava
-- esse gap como "item separado, não bloqueante" — ficou like esperando o
-- achado direto que agora chegou. `fin_criar_lancamento` tem o MESMO gap
-- na criação (`p_conta_id` também só validado por tenant) — mesma classe,
-- mesmo campo, sibling não reportado diretamente pelo review mas achado
-- ao varrer as outras 2 portas de escrita de `transacoes_financeiras.
-- conta_id` (varredura pedida pelo usuário: "veja se não há outros
-- padrões com o mesmo comportamento").
--
-- `fin_criar_transferencia` (conta_origem/conta_destino, §9.74) e
-- `fin_lancar_desagio_antecipacao` (p_conta_id, `COALESCE(extrato.filial_
-- id, conta.filial_id)`, §9.65) JÁ validam filial da conta — confirmado
-- lendo as duas; não precisam de fix aqui.
--
-- Fix: `has_filial_access(v_igreja, conta.filial_id)` — mesmo padrão já
-- usado em `fin_criar_transferencia` pras 2 contas — em `fin_criar_
-- lancamento` (sempre, pro `p_conta_id` recebido) e em `fin_atualizar_
-- lancamento` (só quando `conta_id` está no patch, i.e. está realmente
-- MUDANDO — editar outros campos de uma transação com conta antiga
-- continua funcionando sem re-checar uma conta que não mudou).
--
-- Achado adjacente, NÃO corrigido aqui (pré-existentes, nunca tocadas
-- por esta PR — mesma classe dos "9 RPCs sem has_filial_access" já
-- documentados em docs/arquitetura-financeiro.md §11): `fin_pagar_
-- reembolso` (`p_conta_id`, só `fin_validar_fk_tenant`) e `fin_lancar_
-- sessao` (`conta_id` por item, nem tenant) têm o MESMO gap — adicionados
-- à lista de pendências pra fase dedicada futura.
-- ============================================================================

-- ─── 1. fin_criar_lancamento ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_criar_lancamento(
  p_tipo text,
  p_valor numeric,
  p_data_vencimento date,
  p_conta_id uuid,
  p_descricao text,
  p_categoria_id uuid DEFAULT NULL,
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
  v_conta_filial uuid;
  v_status text;
  v_tipo_lancamento text;
  v_total_parcelas int;
  v_juros numeric; v_multas numeric; v_desconto numeric; v_taxas numeric;
  v_sinal_taxa numeric;
  v_liquido numeric;
  v_data_pagamento date;
  v_data_competencia_base date;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_pai uuid;
  v_warnings text[] := '{}';
  v_parcela int;
  v_venc date;
  v_flag text;
  v_forma_id uuid;
  v_forma_nome text;
  v_subcategoria_id uuid;
  v_centro_custo_id uuid;
  v_base_ministerial_id uuid;
  v_fornecedor_id uuid;
BEGIN
  IF p_tipo NOT IN ('entrada','saida') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: tipo deve ser entrada|saida';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: valor deve ser positivo';
  END IF;
  IF p_data_vencimento IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: data_vencimento obrigatória';
  END IF;

  v_sinal_taxa := CASE WHEN p_tipo = 'saida' THEN 1 ELSE -1 END;

  v_flag := CASE WHEN p_tipo = 'saida'
                 THEN 'autorizado_lancar_despesas'
                 ELSE 'autorizado_lancar_depositos' END;
  v_ctx := public.fin_resolver_contexto(p_contexto, v_flag);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  IF p_extras ? 'filial_id' THEN
    v_filial := NULLIF(p_extras ->> 'filial_id', '')::uuid;
    IF v_filial IS NOT NULL AND (v_ctx ->> 'canal') = 'web'
       AND NOT public.has_filial_access(v_igreja, v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);
  -- Achado do /code-review (P1, §9.80): faltava checar se o CHAMADOR tem
  -- acesso à filial da conta selecionada — fin_validar_fk_tenant só olha
  -- tenant. Sem isso, um tesoureiro restrito à filial B conseguia lançar
  -- (ou, em fin_atualizar_lancamento, mover) uma transação pra uma conta
  -- de outra filial sem nunca ter acesso checado contra ela. Mesmo padrão
  -- já usado pras 2 contas de fin_criar_transferencia (§9.74).
  SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta selecionada';
  END IF;

  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', p_categoria_id, v_igreja);
  PERFORM public.fin_validar_fk_filial('categorias_financeiras', p_categoria_id, v_filial);

  v_subcategoria_id := NULLIF(p_extras ->> 'subcategoria_id','')::uuid;
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', v_subcategoria_id, v_igreja);
  PERFORM public.fin_validar_fk_filial('subcategorias_financeiras', v_subcategoria_id, v_filial);

  v_centro_custo_id := NULLIF(p_extras ->> 'centro_custo_id','')::uuid;
  PERFORM public.fin_validar_fk_tenant('centros_custo', v_centro_custo_id, v_igreja);
  PERFORM public.fin_validar_fk_filial('centros_custo', v_centro_custo_id, v_filial);

  v_base_ministerial_id := NULLIF(p_extras ->> 'base_ministerial_id','')::uuid;
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', v_base_ministerial_id, v_igreja);
  PERFORM public.fin_validar_fk_filial('bases_ministeriais', v_base_ministerial_id, v_filial);

  v_fornecedor_id := NULLIF(p_extras ->> 'fornecedor_id','')::uuid;
  PERFORM public.fin_validar_fk_tenant('fornecedores', v_fornecedor_id, v_igreja);
  PERFORM public.fin_validar_fk_filial('fornecedores', v_fornecedor_id, v_filial);

  v_forma_id := NULLIF(p_extras ->> 'forma_pagamento_id', '')::uuid;
  PERFORM public.fin_validar_fk_tenant('formas_pagamento', v_forma_id, v_igreja);
  IF v_forma_id IS NOT NULL THEN
    PERFORM public.fin_validar_fk_filial('formas_pagamento', v_forma_id, v_filial);
    SELECT nome INTO v_forma_nome FROM public.formas_pagamento WHERE id = v_forma_id;
  ELSIF NULLIF(p_extras ->> 'forma_pagamento', '') IS NOT NULL THEN
    SELECT id, nome INTO v_forma_id, v_forma_nome
      FROM public.formas_pagamento
     WHERE igreja_id = v_igreja
       AND lower(nome) = lower(p_extras ->> 'forma_pagamento')
       AND (filial_id IS NOT DISTINCT FROM v_filial OR filial_id IS NULL)
     ORDER BY (filial_id IS NOT DISTINCT FROM v_filial) DESC, ativo DESC, created_at ASC
     LIMIT 1;
  END IF;

  v_status := COALESCE(p_extras ->> 'status', 'pendente');
  IF v_status NOT IN ('pendente','pago') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status inicial deve ser pendente|pago';
  END IF;

  v_tipo_lancamento := COALESCE(p_extras ->> 'tipo_lancamento', 'unico');
  IF v_tipo_lancamento NOT IN ('unico','parcelado','recorrente') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: tipo_lancamento inválido';
  END IF;

  v_desconto := COALESCE((p_extras ->> 'desconto')::numeric, 0);
  v_taxas    := COALESCE((p_extras ->> 'taxas_administrativas')::numeric, 0);
  v_juros    := CASE WHEN v_status = 'pago' THEN COALESCE((p_extras ->> 'juros')::numeric, 0) ELSE 0 END;
  v_multas   := CASE WHEN v_status = 'pago' THEN COALESCE((p_extras ->> 'multas')::numeric, 0) ELSE 0 END;
  v_liquido  := COALESCE((p_extras ->> 'valor_liquido')::numeric,
                         p_valor + v_juros + v_multas + (v_sinal_taxa * v_taxas) - v_desconto);
  v_data_pagamento := CASE WHEN v_status = 'pago'
                           THEN COALESCE((p_extras ->> 'data_pagamento')::date, p_data_vencimento)
                           ELSE NULL END;

  v_data_competencia_base := COALESCE((p_extras ->> 'data_competencia')::date, p_data_vencimento);

  v_total_parcelas := CASE WHEN v_tipo_lancamento = 'parcelado'
                           THEN GREATEST(COALESCE((p_extras ->> 'total_parcelas')::int, 1), 1)
                           ELSE NULL END;

  FOR v_parcela IN 1 .. COALESCE(v_total_parcelas, 1) LOOP
    v_venc := p_data_vencimento + make_interval(months => v_parcela - 1);

    INSERT INTO public.transacoes_financeiras (
      tipo, tipo_lancamento, descricao, valor, valor_liquido,
      data_vencimento, data_competencia, data_pagamento,
      conta_id, categoria_id, subcategoria_id, centro_custo_id,
      base_ministerial_id, fornecedor_id, forma_pagamento, forma_pagamento_id,
      total_parcelas, numero_parcela, recorrencia, data_fim_recorrencia,
      observacoes, anexo_url, lancado_por, status,
      juros, multas, desconto, taxas_administrativas,
      pessoa_id, sessao_id, solicitacao_reembolso_id,
      origem_registro, lancamento_pai_id, igreja_id, filial_id
    ) VALUES (
      p_tipo, v_tipo_lancamento,
      CASE WHEN v_total_parcelas IS NOT NULL AND v_total_parcelas > 1
           THEN p_descricao || ' (' || v_parcela || '/' || v_total_parcelas || ')'
           ELSE p_descricao END,
      p_valor,
      CASE WHEN v_parcela = 1 THEN v_liquido
           ELSE p_valor + (v_sinal_taxa * v_taxas) - v_desconto END,
      v_venc,
      CASE WHEN v_tipo_lancamento = 'parcelado'
           THEN v_data_competencia_base
           ELSE COALESCE((p_extras ->> 'data_competencia')::date, v_venc) END,
      CASE WHEN v_parcela = 1 THEN v_data_pagamento ELSE NULL END,
      p_conta_id, p_categoria_id,
      v_subcategoria_id,
      v_centro_custo_id,
      v_base_ministerial_id,
      v_fornecedor_id,
      COALESCE(v_forma_nome, NULLIF(p_extras ->> 'forma_pagamento','')),
      v_forma_id,
      v_total_parcelas,
      CASE WHEN v_tipo_lancamento = 'parcelado' THEN v_parcela ELSE NULL END,
      CASE WHEN v_tipo_lancamento = 'recorrente' THEN p_extras ->> 'recorrencia' ELSE NULL END,
      CASE WHEN v_tipo_lancamento = 'recorrente' THEN (p_extras ->> 'data_fim_recorrencia')::date ELSE NULL END,
      NULLIF(p_extras ->> 'observacoes',''),
      NULLIF(p_extras ->> 'anexo_url',''),
      COALESCE(NULLIF(p_extras ->> 'lancado_por','')::uuid, (v_ctx ->> 'ator_user_id')::uuid),
      CASE WHEN v_parcela = 1 THEN v_status ELSE 'pendente' END,
      CASE WHEN v_parcela = 1 THEN v_juros ELSE 0 END,
      CASE WHEN v_parcela = 1 THEN v_multas ELSE 0 END,
      v_desconto, v_taxas,
      NULLIF(p_extras ->> 'pessoa_id','')::uuid,
      NULLIF(p_extras ->> 'sessao_id','')::uuid,
      NULLIF(p_extras ->> 'solicitacao_reembolso_id','')::uuid,
      COALESCE(NULLIF(p_extras ->> 'origem_registro',''), 'manual'),
      v_pai, v_igreja, v_filial
    )
    RETURNING id INTO v_id;

    IF v_parcela = 1 THEN v_pai := v_id; END IF;
    v_ids := v_ids || v_id;
  END LOOP;

  IF v_total_parcelas IS NOT NULL AND v_total_parcelas > 1 THEN
    v_warnings := v_warnings ||
      format('Materializadas %s parcelas mensais a partir de %s (D6)', v_total_parcelas, p_data_vencimento);
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_criar_lancamento', 'transacoes_financeiras', v_pai,
    jsonb_build_object('tipo', p_tipo, 'valor', p_valor,
                       'data_vencimento', p_data_vencimento,
                       'conta_id', p_conta_id, 'categoria_id', p_categoria_id,
                       'extras', p_extras),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'id', v_pai,
                            'ids', to_jsonb(v_ids),
                            'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 2. fin_atualizar_lancamento ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_atualizar_lancamento(
  p_id uuid,
  p_patch jsonb,
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
  v_permitidos text[] := ARRAY[
    'tipo','tipo_lancamento','descricao','valor','valor_liquido',
    'data_vencimento','data_competencia','data_pagamento',
    'conta_id','categoria_id','subcategoria_id','centro_custo_id',
    'base_ministerial_id','fornecedor_id','forma_pagamento','forma_pagamento_id',
    'total_parcelas','numero_parcela','recorrencia','data_fim_recorrencia',
    'observacoes','anexo_url','status','juros','multas','desconto',
    'taxas_administrativas','pessoa_id','filial_id','lancado_por'
  ];
  v_campo text;
  v_aplicar jsonb := '{}'::jsonb;
  v_novo_status text;
  v_tipo_efetivo text;
  v_sinal_taxa numeric;
  v_forma_nome text;
  v_filial_efetiva uuid;
  v_conta_filial uuid;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  -- §9.74: checa acesso à filial ATUAL do lançamento. Mudar filial_id no
  -- patch pra uma filial diferente é coberto pelo bloco abaixo; mudar
  -- conta_id pra uma conta de outra filial é coberto pelo bloco de
  -- fin_validar_fk_tenant('contas', ...) logo abaixo (§9.80 — antes só
  -- validava tenant, agora também has_filial_access da conta nova).
  IF NOT public.has_filial_access(v_igreja, v_atual.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lançamento';
  END IF;

  -- D4: conciliado é imutável até desconciliar.
  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser editado (D4); desconcilie antes';
  END IF;

  -- D10: parcela de lançamento parcelado não diverge de competência das
  -- irmãs sem ação explícita.
  IF p_patch ? 'data_competencia'
     AND v_atual.tipo_lancamento = 'parcelado'
     AND (v_atual.lancamento_pai_id IS NOT NULL OR COALESCE(v_atual.total_parcelas, 1) > 1)
     AND NOT COALESCE((p_patch ->> '_permitir_divergencia_competencia')::boolean, false) THEN
    RAISE EXCEPTION 'FIN_COMPETENCIA_GRUPO: lançamento % pertence a um grupo parcelado; use fin_alterar_competencia_grupo para manter a competência sincronizada entre as parcelas, ou passe _permitir_divergencia_competencia=true para forçar divergência intencional', p_id;
  END IF;

  FOR v_campo IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_campo = ANY (v_permitidos) THEN
      v_aplicar := v_aplicar || jsonb_build_object(v_campo, p_patch -> v_campo);
    ELSIF v_campo = '_permitir_divergencia_competencia' THEN
      NULL;
    ELSE
      v_warnings := v_warnings || format('campo %s ignorado', v_campo);
    END IF;
  END LOOP;

  PERFORM public.fin_validar_fk_tenant('contas', NULLIF(v_aplicar ->> 'conta_id','')::uuid, v_igreja);
  -- Achado do /code-review (P1, §9.80): conta_id só era validado por
  -- tenant — um tesoureiro restrito à filial B conseguia trocar a conta
  -- de uma transação acessível (própria filial B) pra uma conta da filial
  -- A sem nunca ter acesso checado contra A; o trigger de saldo (sempre
  -- recalcula, statement-level) então recalculava o saldo da conta nova
  -- também. Só dispara quando conta_id está de fato no patch — editar
  -- outro campo de uma transação com conta antiga não exige re-checar
  -- uma conta que não mudou.
  IF v_aplicar ? 'conta_id' THEN
    SELECT filial_id INTO v_conta_filial FROM public.contas
     WHERE id = NULLIF(v_aplicar ->> 'conta_id','')::uuid;
    IF NOT public.has_filial_access(v_igreja, v_conta_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta selecionada';
    END IF;
  END IF;

  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(v_aplicar ->> 'categoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(v_aplicar ->> 'subcategoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(v_aplicar ->> 'centro_custo_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(v_aplicar ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('fornecedores', NULLIF(v_aplicar ->> 'fornecedor_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('formas_pagamento', NULLIF(v_aplicar ->> 'forma_pagamento_id','')::uuid, v_igreja);

  IF v_aplicar ? 'forma_pagamento_id' THEN
    SELECT nome INTO v_forma_nome FROM public.formas_pagamento
     WHERE id = NULLIF(v_aplicar ->> 'forma_pagamento_id','')::uuid;
  END IF;

  v_filial_efetiva := CASE WHEN v_aplicar ? 'filial_id'
                            THEN NULLIF(v_aplicar ->> 'filial_id','')::uuid
                            ELSE v_atual.filial_id END;

  IF v_aplicar ? 'categoria_id' OR v_aplicar ? 'filial_id' THEN
    PERFORM public.fin_validar_fk_filial('categorias_financeiras',
      CASE WHEN v_aplicar ? 'categoria_id' THEN NULLIF(v_aplicar ->> 'categoria_id','')::uuid ELSE v_atual.categoria_id END,
      v_filial_efetiva);
  END IF;
  IF v_aplicar ? 'subcategoria_id' OR v_aplicar ? 'filial_id' THEN
    PERFORM public.fin_validar_fk_filial('subcategorias_financeiras',
      CASE WHEN v_aplicar ? 'subcategoria_id' THEN NULLIF(v_aplicar ->> 'subcategoria_id','')::uuid ELSE v_atual.subcategoria_id END,
      v_filial_efetiva);
  END IF;
  IF v_aplicar ? 'centro_custo_id' OR v_aplicar ? 'filial_id' THEN
    PERFORM public.fin_validar_fk_filial('centros_custo',
      CASE WHEN v_aplicar ? 'centro_custo_id' THEN NULLIF(v_aplicar ->> 'centro_custo_id','')::uuid ELSE v_atual.centro_custo_id END,
      v_filial_efetiva);
  END IF;
  IF v_aplicar ? 'base_ministerial_id' OR v_aplicar ? 'filial_id' THEN
    PERFORM public.fin_validar_fk_filial('bases_ministeriais',
      CASE WHEN v_aplicar ? 'base_ministerial_id' THEN NULLIF(v_aplicar ->> 'base_ministerial_id','')::uuid ELSE v_atual.base_ministerial_id END,
      v_filial_efetiva);
  END IF;
  IF v_aplicar ? 'fornecedor_id' OR v_aplicar ? 'filial_id' THEN
    PERFORM public.fin_validar_fk_filial('fornecedores',
      CASE WHEN v_aplicar ? 'fornecedor_id' THEN NULLIF(v_aplicar ->> 'fornecedor_id','')::uuid ELSE v_atual.fornecedor_id END,
      v_filial_efetiva);
  END IF;
  IF v_aplicar ? 'forma_pagamento_id' OR v_aplicar ? 'filial_id' THEN
    PERFORM public.fin_validar_fk_filial('formas_pagamento',
      CASE WHEN v_aplicar ? 'forma_pagamento_id' THEN NULLIF(v_aplicar ->> 'forma_pagamento_id','')::uuid ELSE v_atual.forma_pagamento_id END,
      v_filial_efetiva);
  END IF;

  -- §9.74: quando a filial está mudando de fato, o CHAMADOR precisa ter
  -- acesso à filial NOVA também — não só à atual (já checado acima). Sem
  -- isso, um tesoureiro da filial A movia uma transação PRA a filial B
  -- sem nunca ter acesso checado contra B.
  IF v_aplicar ? 'filial_id' AND v_filial_efetiva IS DISTINCT FROM v_atual.filial_id
     AND NOT public.has_filial_access(v_igreja, v_filial_efetiva) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
  END IF;

  v_novo_status := COALESCE(v_aplicar ->> 'status', v_atual.status);
  IF v_novo_status NOT IN ('pendente','pago','cancelado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status inválido (%)', v_novo_status;
  END IF;

  v_tipo_efetivo := COALESCE(v_aplicar ->> 'tipo', v_atual.tipo);
  v_sinal_taxa := CASE WHEN v_tipo_efetivo = 'saida' THEN 1 ELSE -1 END;

  IF NOT (v_aplicar ? 'valor_liquido')
     AND (v_aplicar ?| ARRAY['valor','juros','multas','desconto','taxas_administrativas']) THEN
    v_aplicar := v_aplicar || jsonb_build_object('valor_liquido',
        COALESCE((v_aplicar ->> 'valor')::numeric, v_atual.valor)
      + COALESCE((v_aplicar ->> 'juros')::numeric, v_atual.juros, 0)
      + COALESCE((v_aplicar ->> 'multas')::numeric, v_atual.multas, 0)
      + (v_sinal_taxa * COALESCE((v_aplicar ->> 'taxas_administrativas')::numeric, v_atual.taxas_administrativas, 0))
      - COALESCE((v_aplicar ->> 'desconto')::numeric, v_atual.desconto, 0));
  END IF;

  UPDATE public.transacoes_financeiras SET
    tipo                 = COALESCE(v_aplicar ->> 'tipo', tipo),
    tipo_lancamento      = COALESCE(v_aplicar ->> 'tipo_lancamento', tipo_lancamento),
    descricao            = COALESCE(v_aplicar ->> 'descricao', descricao),
    valor                = COALESCE((v_aplicar ->> 'valor')::numeric, valor),
    valor_liquido        = CASE WHEN v_aplicar ? 'valor_liquido'
                                THEN (v_aplicar ->> 'valor_liquido')::numeric ELSE valor_liquido END,
    data_vencimento      = COALESCE((v_aplicar ->> 'data_vencimento')::date, data_vencimento),
    data_competencia     = CASE WHEN v_aplicar ? 'data_competencia'
                                THEN NULLIF(v_aplicar ->> 'data_competencia','')::date ELSE data_competencia END,
    data_pagamento       = CASE WHEN v_aplicar ? 'data_pagamento'
                                THEN NULLIF(v_aplicar ->> 'data_pagamento','')::date ELSE data_pagamento END,
    conta_id             = COALESCE(NULLIF(v_aplicar ->> 'conta_id','')::uuid, conta_id),
    categoria_id         = CASE WHEN v_aplicar ? 'categoria_id'
                                THEN NULLIF(v_aplicar ->> 'categoria_id','')::uuid ELSE categoria_id END,
    subcategoria_id      = CASE WHEN v_aplicar ? 'subcategoria_id'
                                THEN NULLIF(v_aplicar ->> 'subcategoria_id','')::uuid ELSE subcategoria_id END,
    centro_custo_id      = CASE WHEN v_aplicar ? 'centro_custo_id'
                                THEN NULLIF(v_aplicar ->> 'centro_custo_id','')::uuid ELSE centro_custo_id END,
    base_ministerial_id  = CASE WHEN v_aplicar ? 'base_ministerial_id'
                                THEN NULLIF(v_aplicar ->> 'base_ministerial_id','')::uuid ELSE base_ministerial_id END,
    fornecedor_id        = CASE WHEN v_aplicar ? 'fornecedor_id'
                                THEN NULLIF(v_aplicar ->> 'fornecedor_id','')::uuid ELSE fornecedor_id END,
    forma_pagamento_id   = CASE WHEN v_aplicar ? 'forma_pagamento_id'
                                THEN NULLIF(v_aplicar ->> 'forma_pagamento_id','')::uuid ELSE forma_pagamento_id END,
    forma_pagamento      = CASE WHEN v_aplicar ? 'forma_pagamento_id'
                                THEN v_forma_nome
                                WHEN v_aplicar ? 'forma_pagamento'
                                THEN NULLIF(v_aplicar ->> 'forma_pagamento','') ELSE forma_pagamento END,
    total_parcelas       = CASE WHEN v_aplicar ? 'total_parcelas'
                                THEN NULLIF(v_aplicar ->> 'total_parcelas','')::int ELSE total_parcelas END,
    numero_parcela       = CASE WHEN v_aplicar ? 'numero_parcela'
                                THEN NULLIF(v_aplicar ->> 'numero_parcela','')::int ELSE numero_parcela END,
    recorrencia          = CASE WHEN v_aplicar ? 'recorrencia'
                                THEN NULLIF(v_aplicar ->> 'recorrencia','') ELSE recorrencia END,
    data_fim_recorrencia = CASE WHEN v_aplicar ? 'data_fim_recorrencia'
                                THEN NULLIF(v_aplicar ->> 'data_fim_recorrencia','')::date ELSE data_fim_recorrencia END,
    observacoes          = CASE WHEN v_aplicar ? 'observacoes'
                                THEN NULLIF(v_aplicar ->> 'observacoes','') ELSE observacoes END,
    anexo_url            = CASE WHEN v_aplicar ? 'anexo_url'
                                THEN NULLIF(v_aplicar ->> 'anexo_url','') ELSE anexo_url END,
    status               = v_novo_status,
    juros                = COALESCE((v_aplicar ->> 'juros')::numeric, juros),
    multas               = COALESCE((v_aplicar ->> 'multas')::numeric, multas),
    desconto             = COALESCE((v_aplicar ->> 'desconto')::numeric, desconto),
    taxas_administrativas = COALESCE((v_aplicar ->> 'taxas_administrativas')::numeric, taxas_administrativas),
    pessoa_id            = CASE WHEN v_aplicar ? 'pessoa_id'
                                THEN NULLIF(v_aplicar ->> 'pessoa_id','')::uuid ELSE pessoa_id END,
    filial_id            = CASE WHEN v_aplicar ? 'filial_id'
                                THEN NULLIF(v_aplicar ->> 'filial_id','')::uuid ELSE filial_id END,
    lancado_por          = COALESCE(NULLIF(v_aplicar ->> 'lancado_por','')::uuid, lancado_por),
    updated_at           = now()
  WHERE id = p_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_atualizar_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('patch', p_patch),
    jsonb_build_object('status_antes', v_atual.status, 'status_depois', v_novo_status));

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'warnings', to_jsonb(v_warnings));
END;
$$;
