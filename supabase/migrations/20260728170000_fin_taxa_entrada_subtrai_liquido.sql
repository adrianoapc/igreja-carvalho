-- ============================================================================
-- Fix: taxas_administrativas deve SUBTRAIR de valor_liquido em ENTRADAS,
-- não somar (achado da avaliação de taxa de cartão em ofertas, jul/2026)
--
-- Confirmado com print de tela real: lançamento "Oferta - C.Débito", Valor
-- (Bruto) R$200,00, Valor Pago (Líquido) R$203,58, Taxas Administrativas
-- R$3,58 — o líquido ficava MAIOR que o bruto. Isso não corresponde a
-- dinheiro real: a adquirente fica com a taxa, a igreja recebe MENOS, não
-- mais. A fórmula `valor + juros + multas + taxas - desconto` está correta
-- para SAÍDA (você paga mais por causa de uma taxa), mas estava sendo
-- aplicada igual para ENTRADA (deveria subtrair: você recebe menos).
--
-- `TransacaoDetalheDrawer.tsx` (ajuste manual pós-criação, no fluxo de
-- conciliação) já calculava na direção certa — `liquido = bruto - taxas +
-- juros + multas - desconto`, com o comentário "Taxas que reduzem o valor
-- (ex: taxa PIX, cartão)" — mas isso só valia quando o usuário abria esse
-- drawer manualmente depois; o ponto de CRIAÇÃO (fin_lancar_sessao, usado
-- pelo Relatório de Ofertas) e os demais pontos de cálculo automático
-- (fin_criar_lancamento, fin_atualizar_lancamento, fin_alterar_status_
-- lancamento) usavam a fórmula aditiva sempre.
--
-- Fix: taxas_administrativas soma para 'saida' (comportamento inalterado)
-- e subtrai para 'entrada'. juros/multas continuam somando e desconto
-- continua subtraindo nos dois tipos (fazem sentido nas duas direções).
--
-- Escopo estrito desta migration: só a fórmula de valor_liquido. Motor de
-- conciliação, fonte real da taxa via getnet_financeiro_resumo, relatório
-- agregado de taxas e reconciliação Oferta↔Getnet↔Banco ficam para fases
-- seguintes (avaliação registrada, não implementada ainda).
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
  v_status text;
  v_tipo_lancamento text;
  v_total_parcelas int;
  v_juros numeric; v_multas numeric; v_desconto numeric; v_taxas numeric;
  v_sinal_taxa numeric;
  v_liquido numeric;
  v_data_pagamento date;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_pai uuid;
  v_warnings text[] := '{}';
  v_parcela int;
  v_venc date;
  v_flag text;
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

  -- Taxa administrativa reduz o que se RECEBE (entrada) e aumenta o que se
  -- PAGA (saída) — ver cabeçalho desta migration.
  v_sinal_taxa := CASE WHEN p_tipo = 'saida' THEN 1 ELSE -1 END;

  v_flag := CASE WHEN p_tipo = 'saida'
                 THEN 'autorizado_lancar_despesas'
                 ELSE 'autorizado_lancar_depositos' END;
  v_ctx := public.fin_resolver_contexto(p_contexto, v_flag);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  -- filial explícita do chamador tem precedência (ex.: "todas as filiais" = null)
  IF p_extras ? 'filial_id' THEN
    v_filial := NULLIF(p_extras ->> 'filial_id', '')::uuid;
    IF v_filial IS NOT NULL AND (v_ctx ->> 'canal') = 'web'
       AND NOT public.has_filial_access(v_igreja, v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', p_categoria_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(p_extras ->> 'subcategoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(p_extras ->> 'centro_custo_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(p_extras ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('fornecedores', NULLIF(p_extras ->> 'fornecedor_id','')::uuid, v_igreja);

  v_status := COALESCE(p_extras ->> 'status', 'pendente');
  IF v_status NOT IN ('pendente','pago') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status inicial deve ser pendente|pago';
  END IF;

  v_tipo_lancamento := COALESCE(p_extras ->> 'tipo_lancamento', 'unico');
  IF v_tipo_lancamento NOT IN ('unico','parcelado','recorrente') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: tipo_lancamento inválido';
  END IF;

  -- ADR-027: juros/multas só existem quando pago; desconto/taxas sempre.
  v_desconto := COALESCE((p_extras ->> 'desconto')::numeric, 0);
  v_taxas    := COALESCE((p_extras ->> 'taxas_administrativas')::numeric, 0);
  v_juros    := CASE WHEN v_status = 'pago' THEN COALESCE((p_extras ->> 'juros')::numeric, 0) ELSE 0 END;
  v_multas   := CASE WHEN v_status = 'pago' THEN COALESCE((p_extras ->> 'multas')::numeric, 0) ELSE 0 END;
  v_liquido  := COALESCE((p_extras ->> 'valor_liquido')::numeric,
                         p_valor + v_juros + v_multas + (v_sinal_taxa * v_taxas) - v_desconto);
  v_data_pagamento := CASE WHEN v_status = 'pago'
                           THEN COALESCE((p_extras ->> 'data_pagamento')::date, p_data_vencimento)
                           ELSE NULL END;

  v_total_parcelas := CASE WHEN v_tipo_lancamento = 'parcelado'
                           THEN GREATEST(COALESCE((p_extras ->> 'total_parcelas')::int, 1), 1)
                           ELSE NULL END;

  FOR v_parcela IN 1 .. COALESCE(v_total_parcelas, 1) LOOP
    v_venc := p_data_vencimento + make_interval(months => v_parcela - 1);

    INSERT INTO public.transacoes_financeiras (
      tipo, tipo_lancamento, descricao, valor, valor_liquido,
      data_vencimento, data_competencia, data_pagamento,
      conta_id, categoria_id, subcategoria_id, centro_custo_id,
      base_ministerial_id, fornecedor_id, forma_pagamento,
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
      -- parcelas futuras nascem pendentes: líquido sem juros/multas
      CASE WHEN v_parcela = 1 THEN v_liquido
           ELSE p_valor + (v_sinal_taxa * v_taxas) - v_desconto END,
      v_venc,
      COALESCE((p_extras ->> 'data_competencia')::date, v_venc),
      CASE WHEN v_parcela = 1 THEN v_data_pagamento ELSE NULL END,
      p_conta_id, p_categoria_id,
      NULLIF(p_extras ->> 'subcategoria_id','')::uuid,
      NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
      NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
      NULLIF(p_extras ->> 'fornecedor_id','')::uuid,
      NULLIF(p_extras ->> 'forma_pagamento',''),
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
    'base_ministerial_id','fornecedor_id','forma_pagamento',
    'total_parcelas','numero_parcela','recorrencia','data_fim_recorrencia',
    'observacoes','anexo_url','status','juros','multas','desconto',
    'taxas_administrativas','pessoa_id','filial_id','lancado_por'
  ];
  v_campo text;
  v_aplicar jsonb := '{}'::jsonb;
  v_novo_status text;
  v_tipo_efetivo text;
  v_sinal_taxa numeric;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  -- D4: conciliado é imutável até desconciliar.
  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser editado (D4); desconcilie antes';
  END IF;

  FOR v_campo IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_campo = ANY (v_permitidos) THEN
      v_aplicar := v_aplicar || jsonb_build_object(v_campo, p_patch -> v_campo);
    ELSE
      v_warnings := v_warnings || format('campo %s ignorado', v_campo);
    END IF;
  END LOOP;

  -- Valida FKs alteradas dentro do tenant
  PERFORM public.fin_validar_fk_tenant('contas', NULLIF(v_aplicar ->> 'conta_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(v_aplicar ->> 'categoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(v_aplicar ->> 'subcategoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(v_aplicar ->> 'centro_custo_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(v_aplicar ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('fornecedores', NULLIF(v_aplicar ->> 'fornecedor_id','')::uuid, v_igreja);

  v_novo_status := COALESCE(v_aplicar ->> 'status', v_atual.status);
  IF v_novo_status NOT IN ('pendente','pago','cancelado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status inválido (%)', v_novo_status;
  END IF;

  -- Taxa administrativa reduz o que se RECEBE (entrada) e aumenta o que se
  -- PAGA (saída) — tipo efetivo é o do patch, senão o já gravado.
  v_tipo_efetivo := COALESCE(v_aplicar ->> 'tipo', v_atual.tipo);
  v_sinal_taxa := CASE WHEN v_tipo_efetivo = 'saida' THEN 1 ELSE -1 END;

  -- ADR-027: recalcula valor_liquido quando componentes mudam sem fixação explícita.
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
    forma_pagamento      = CASE WHEN v_aplicar ? 'forma_pagamento'
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

-- ─── 3. fin_alterar_status_lancamento ───────────────────────────────────────

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

-- ─── 4. fin_lancar_sessao ───────────────────────────────────────────────────
-- Sempre tipo='entrada' aqui — taxa sempre subtrai, sem condicional.

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
      v_valor - COALESCE(v_taxas, 0),
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
