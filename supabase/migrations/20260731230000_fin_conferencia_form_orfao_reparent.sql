-- ============================================================================
-- 3 achados do /code-review (PR #67, 34ª rodada — review de 01/08 17:32,
-- commit revisado b423301), todos verificados por leitura direta:
--
-- 1) P1 — fin_conferencia_totais_getnet (20260731220000, item 1 desta
--    própria PR): o fix do ON DELETE SET NULL (item 3 da MESMA migration)
--    tem um efeito colateral aqui — o JOIN (INNER) com formas_pagamento
--    pra classificar "cartão" (fp.nome ILIKE '%cart%') agora DESCARTA da
--    soma qualquer transação cuja forma de pagamento tenha sido excluída
--    depois (forma_pagamento_id virou NULL, INNER JOIN não casa NULL).
--    Resultado: excluir uma forma "Cartão de Crédito" antiga faz a
--    conferência subestimar SILENCIOSAMENTE oferta_bruto e taxa_mdr de
--    períodos passados que a usaram — exatamente o tipo de gap que essa
--    RPC existe pra detectar, se voltando contra ela mesma.
--
--    Fix: LEFT JOIN + classifica por COALESCE(fp.nome, t.forma_pagamento)
--    — cai pro texto legado (nunca é limpo pelo ON DELETE SET NULL,
--    continua com o nome da forma no momento da transação) quando o FK
--    não existe mais.
--
-- 2) P2 — fin_criar_lancamento (20260731220000): quando forma_pagamento_id
--    vem EXPLÍCITO (não por rótulo), só valida com fin_validar_fk_tenant
--    (tenant, não filial). useDadosApoio.ts:110-129, na visão "Todas as
--    filiais" (isAllFiliais), lista formas de TODAS as filiais sem
--    filtro — e a transação criada nessa visão nasce com filial_id NULL
--    (global). Selecionar a forma de uma filial específica cria uma
--    transação global referenciando metadado privado de uma filial:
--    usuários de OUTRA filial enxergam a transação (é global) mas RLS
--    esconde a forma referenciada deles — exibição quebrada e detecção de
--    "é dinheiro" (useFormaPagamentoDinheiroId) falha silenciosamente pra
--    eles. Mesmo gap existe em fin_atualizar_lancamento (mesmo padrão de
--    validação, não citado pelo achado mas mesma causa raiz — corrigido
--    junto pra não virar achado de rodada futura).
--
--    Fix: forma_pagamento_id explícito só é aceito se for global
--    (filial_id NULL) ou da MESMA filial do lançamento — mesma regra já
--    aplicada à resolução por rótulo (20260731220000, item 2).
--
-- 3) P2 — fin_alterar_competencia_grupo / fin_excluir_lancamento
--    (20260731170000): lancamento_pai_id é `ON DELETE SET NULL`
--    (20260710120000). Excluir a parcela RAIZ do grupo (escopo
--    somente_este ou este_e_futuras) orfaneia TODAS as irmãs restantes de
--    uma vez (todas apontavam lancamento_pai_id = id da raiz). Uma edição
--    de competência subsequente em QUALQUER irmã sobrevivente chega em
--    fin_alterar_competencia_grupo com lancamento_pai_id NULL, trata a
--    própria linha como raiz de um grupo de 1, atualiza só ela e reporta
--    sucesso — as outras irmãs, também órfãs, divergem de novo em
--    silêncio, sem nenhum aviso de que o grupo se partiu.
--
--    Fix: fin_excluir_lancamento, antes de excluir uma linha que é RAIZ
--    (lancamento_pai_id IS NULL) de um grupo com irmãs que vão
--    sobreviver à exclusão, promove a irmã sobrevivente de menor
--    data_vencimento a nova raiz (lancamento_pai_id := NULL) e reaponta
--    as demais sobreviventes pra ela — o grupo nunca fica com a FK do elo
--    pai apagada por baixo do tapete.
-- ============================================================================

-- ─── 1. fin_conferencia_totais_getnet — LEFT JOIN, fallback pro texto legado

CREATE OR REPLACE FUNCTION public.fin_conferencia_totais_getnet(
  p_conta_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_conta_filial uuid;
  v_oferta_bruto numeric;
  v_taxa_mdr numeric;
  v_desagio_lancado numeric;
  v_banco_creditado numeric;
  v_esperado numeric;
  v_diferenca numeric;
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: período inválido';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);

  SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial desta conta';
  END IF;

  -- LEFT JOIN (não INNER): forma_pagamento_id pode ter virado NULL por um
  -- ON DELETE SET NULL (a forma foi excluída depois da transação —
  -- 20260731220000, item 3). Classificar por COALESCE(fp.nome,
  -- t.forma_pagamento) usa o texto legado (nunca apagado) nesse caso, em
  -- vez de descartar a linha da soma inteira (achado do /code-review:
  -- excluir uma forma "Cartão" antiga subestimava a conferência em
  -- silêncio pros períodos que a usaram).
  SELECT COALESCE(SUM(t.valor), 0), COALESCE(SUM(t.taxas_administrativas), 0)
    INTO v_oferta_bruto, v_taxa_mdr
    FROM public.transacoes_financeiras t
    LEFT JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
   WHERE t.igreja_id = v_igreja
     AND t.conta_id = p_conta_id
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.data_vencimento BETWEEN p_data_inicio AND p_data_fim
     AND COALESCE(fp.nome, t.forma_pagamento) ILIKE '%cart%';

  SELECT COALESCE(SUM(tf.valor), 0)
    INTO v_desagio_lancado
    FROM public.getnet_antecipacao_lotes lote
    JOIN public.transacoes_financeiras tf ON tf.id = lote.lancamento_desagio_id
   WHERE lote.igreja_id = v_igreja
     AND lote.status = 'lancamento_criado'
     AND tf.conta_id = p_conta_id
     AND tf.data_vencimento BETWEEN p_data_inicio AND p_data_fim;

  SELECT COALESCE(SUM(eb.valor), 0)
    INTO v_banco_creditado
    FROM public.extratos_bancarios eb
   WHERE eb.igreja_id = v_igreja
     AND eb.conta_id = p_conta_id
     AND eb.tipo = 'credito'
     AND eb.data_transacao BETWEEN p_data_inicio AND p_data_fim;

  v_esperado := v_oferta_bruto - v_taxa_mdr - v_desagio_lancado;
  v_diferenca := v_esperado - v_banco_creditado;

  RETURN jsonb_build_object(
    'ok', true,
    'oferta_bruto', v_oferta_bruto,
    'taxa_mdr', v_taxa_mdr,
    'desagio_lancado', v_desagio_lancado,
    'esperado_banco', v_esperado,
    'banco_creditado', v_banco_creditado,
    'diferenca_nao_explicada', v_diferenca
  );
END;
$$;

-- ─── 2. fin_criar_lancamento — forma_pagamento_id explícito valida filial ──

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
  v_forma_id uuid;
  v_forma_nome text;
  v_forma_filial uuid;
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
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', p_categoria_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(p_extras ->> 'subcategoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(p_extras ->> 'centro_custo_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(p_extras ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('fornecedores', NULLIF(p_extras ->> 'fornecedor_id','')::uuid, v_igreja);

  v_forma_id := NULLIF(p_extras ->> 'forma_pagamento_id', '')::uuid;
  PERFORM public.fin_validar_fk_tenant('formas_pagamento', v_forma_id, v_igreja);
  IF v_forma_id IS NOT NULL THEN
    SELECT nome, filial_id INTO v_forma_nome, v_forma_filial
      FROM public.formas_pagamento WHERE id = v_forma_id;
    -- Explícito também respeita filial: só global (filial_id NULL) ou da
    -- MESMA filial do lançamento — senão "Todas as filiais" (v_filial
    -- NULL, useDadosApoio sem filtro) deixava criar uma transação global
    -- apontando pra forma de uma filial específica, invisível via RLS pra
    -- quem estivesse em outra filial (achado do /code-review).
    IF v_forma_filial IS NOT NULL AND v_forma_filial IS DISTINCT FROM v_filial THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: forma de pagamento pertence a outra filial';
    END IF;
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
      COALESCE((p_extras ->> 'data_competencia')::date, v_venc),
      CASE WHEN v_parcela = 1 THEN v_data_pagamento ELSE NULL END,
      p_conta_id, p_categoria_id,
      NULLIF(p_extras ->> 'subcategoria_id','')::uuid,
      NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
      NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
      NULLIF(p_extras ->> 'fornecedor_id','')::uuid,
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

-- ─── 2b. fin_atualizar_lancamento — mesmo guard de filial pro patch ────────
-- Mesma causa raiz do item 2 acima, não citada pelo achado mas mesmo
-- caminho (allow-list de patch aceita forma_pagamento_id validado só por
-- tenant) — corrigido junto pra não repetir o achado numa rodada futura.

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
  v_forma_filial uuid;
  v_filial_efetiva uuid;
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
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser editado (D4); desconcilie antes';
  END IF;

  FOR v_campo IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_campo = ANY (v_permitidos) THEN
      v_aplicar := v_aplicar || jsonb_build_object(v_campo, p_patch -> v_campo);
    ELSE
      v_warnings := v_warnings || format('campo %s ignorado', v_campo);
    END IF;
  END LOOP;

  PERFORM public.fin_validar_fk_tenant('contas', NULLIF(v_aplicar ->> 'conta_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(v_aplicar ->> 'categoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(v_aplicar ->> 'subcategoria_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(v_aplicar ->> 'centro_custo_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(v_aplicar ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('fornecedores', NULLIF(v_aplicar ->> 'fornecedor_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('formas_pagamento', NULLIF(v_aplicar ->> 'forma_pagamento_id','')::uuid, v_igreja);

  IF v_aplicar ? 'forma_pagamento_id' THEN
    SELECT nome, filial_id INTO v_forma_nome, v_forma_filial FROM public.formas_pagamento
     WHERE id = NULLIF(v_aplicar ->> 'forma_pagamento_id','')::uuid;
    v_filial_efetiva := CASE WHEN v_aplicar ? 'filial_id'
                              THEN NULLIF(v_aplicar ->> 'filial_id','')::uuid
                              ELSE v_atual.filial_id END;
    IF v_forma_filial IS NOT NULL AND v_forma_filial IS DISTINCT FROM v_filial_efetiva THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: forma de pagamento pertence a outra filial';
    END IF;
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

-- ─── 3. fin_excluir_lancamento — reparenteia o grupo antes de apagar a raiz

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
  v_a_excluir uuid[];
  v_novo_pai uuid;
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

  -- Calcula ANTES de excluir quais ids serão removidos, pra poder
  -- reparentear o grupo (item abaixo) antes que a FK lancamento_pai_id
  -- (ON DELETE SET NULL) orfaneie as irmãs sozinha.
  --
  -- Achado próprio (não veio do /code-review, descoberto testando o fix
  -- de reparenting no harness): `conciliacao_status NOT IN (...)` é NULL
  -- — não TRUE — pra qualquer linha com conciliacao_status IS NULL (o
  -- caso comum, toda transação não conciliada), e WHERE descarta linhas
  -- cujo predicado é NULL. Resultado: escopo este_e_futuras NUNCA
  -- removia as parcelas futuras de verdade (só a linha de p_id, via o
  -- primeiro `id = p_id` do OR) — bug pré-existente nesta mesma função
  -- (20260731170000), não introduzido por este fix, mas corrigido aqui
  -- já que está bem ao lado do reparenting. Fix: `IS NULL OR NOT IN`.
  IF v_escopo = 'este_e_futuras' THEN
    v_pai := COALESCE(v_atual.lancamento_pai_id, v_atual.id);
    SELECT array_agg(id) INTO v_a_excluir
      FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja
       AND (id = p_id
            OR ((lancamento_pai_id = v_pai OR id = v_pai)
                AND data_vencimento >= v_atual.data_vencimento
                AND status = 'pendente'
                AND (conciliacao_status IS NULL
                     OR conciliacao_status NOT IN ('conciliado_extrato','conciliado_bot'))));
  ELSE
    v_a_excluir := ARRAY[p_id];
  END IF;

  -- Se a linha sendo excluída é a RAIZ (lancamento_pai_id IS NULL) de um
  -- grupo, e alguma irmã sobrevive à exclusão, promove a sobrevivente de
  -- menor data_vencimento a nova raiz e reaponta as demais sobreviventes
  -- pra ela — sem isso, o ON DELETE SET NULL da FK orfaneia TODAS as
  -- irmãs de uma vez quando a raiz é apagada (achado do /code-review:
  -- uma edição de competência subsequente numa irmã órfã vira um "grupo"
  -- de 1, atualiza só ela e reporta sucesso, escondendo que o grupo se
  -- partiu).
  IF v_atual.id = ANY(v_a_excluir) AND v_atual.lancamento_pai_id IS NULL THEN
    SELECT id INTO v_novo_pai
      FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja
       AND lancamento_pai_id = v_atual.id
       AND NOT (id = ANY(v_a_excluir))
     ORDER BY data_vencimento ASC, id ASC
     LIMIT 1;

    IF v_novo_pai IS NOT NULL THEN
      UPDATE public.transacoes_financeiras SET lancamento_pai_id = NULL, updated_at = now()
       WHERE id = v_novo_pai;
      UPDATE public.transacoes_financeiras SET lancamento_pai_id = v_novo_pai, updated_at = now()
       WHERE igreja_id = v_igreja
         AND lancamento_pai_id = v_atual.id
         AND id <> v_novo_pai
         AND NOT (id = ANY(v_a_excluir));
      v_warnings := v_warnings ||
        format('grupo reparenteado: parcela/ocorrência %s vira a nova referência do grupo', v_novo_pai);
    END IF;
  END IF;

  IF v_escopo = 'este_e_futuras' THEN
    WITH del AS (
      DELETE FROM public.transacoes_financeiras
       WHERE id = ANY(v_a_excluir)
      RETURNING id
    )
    SELECT array_agg(id) INTO v_ids FROM del;
  ELSE
    DELETE FROM public.transacoes_financeiras WHERE id = p_id;
    v_ids := ARRAY[p_id];

    SELECT count(*) INTO v_irmas FROM public.transacoes_financeiras
     WHERE igreja_id = v_igreja
       AND (lancamento_pai_id = COALESCE(v_novo_pai, v_atual.lancamento_pai_id, v_atual.id)
            OR id = COALESCE(v_novo_pai, v_atual.lancamento_pai_id));
    IF v_irmas > 0 THEN
      v_warnings := v_warnings ||
        format('%s parcela(s)/ocorrência(s) irmã(s) permanecem; use escopo este_e_futuras para remover as futuras', v_irmas);
    END IF;
  END IF;

  IF v_atual.status = 'pago' THEN
    PERFORM public.fin_recalcular_saldo_conta(v_atual.conta_id, true, v_ctx);
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_excluir_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('escopo', v_escopo,
                       'snapshot', to_jsonb(v_atual)),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings));
END;
$$;
