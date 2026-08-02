-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 02/08 01:21, commit revisado
-- f86185b), real:
--
-- fin_criar_lancamento (20260731260000), sem `p_extras.data_competencia`
-- explícito, usava `COALESCE((p_extras ->> 'data_competencia')::date,
-- v_venc)` DENTRO do loop de parcelas — `v_venc` avança 1 mês por
-- iteração (`p_data_vencimento + make_interval(months => v_parcela - 1)`),
-- então cada parcela nascia com uma `data_competencia` PRÓPRIA em vez de
-- todas compartilharem a competência da compra original. Isso já nasce
-- violando o invariante que o próprio D10 (`fin_atualizar_lancamento`,
-- guard `FIN_COMPETENCIA_GRUPO`) assume e protege — o guard impede
-- DIVERGIR depois, mas o grupo já nascia divergente, diluindo a compra
-- entre vários períodos de DRE sem nenhuma ação do usuário.
--
-- TransacaoDialog.tsx (a única UI que chama fin_criar_lancamento hoje)
-- sempre manda `data_competencia` explícito, então o caminho quebrado só
-- afeta chamadores que omitem o campo (bot, integrações futuras) — mas
-- fin_criar_lancamento é a porta única (ADR-029), então precisa ser
-- seguro pra QUALQUER chamador, não só o atual.
--
-- Fix: calcula a competência-base UMA VEZ, antes do loop, com fallback pra
-- `p_data_vencimento` (a data da parcela 1, não a de cada parcela) — e
-- usa esse valor fixo pra TODAS as parcelas quando `tipo_lancamento =
-- 'parcelado'`. `recorrente`/`unico` continuam com o comportamento
-- anterior (nesta função eles nunca de fato iteram mais de uma vez —
-- `v_total_parcelas` só é setado pra `parcelado` — mas o `CASE` deixa a
-- regra explícita pra não depender dessa coincidência se a função crescer
-- no futuro pra materializar ocorrências recorrentes em lote aqui
-- também, caso em que cada ocorrência LEGITIMAMENTE quer sua própria
-- competência pela data de vencimento).
-- ============================================================================

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

  -- §9.67: base FIXA (não recalculada por parcela) — sem isso, o
  -- COALESCE(..., v_venc) dentro do loop dava uma data_competencia
  -- DIFERENTE pra cada parcela (v_venc avança 1 mês por iteração),
  -- violando o invariante "grupo parcelado tem 1 competência" que o
  -- guard D10 (fin_atualizar_lancamento) assume e protege depois de
  -- criado — o grupo já nascia divergente.
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
      -- 'parcelado': mesma competência-base pra TODAS as parcelas do
      -- grupo (fix do achado). 'unico'/'recorrente': comportamento
      -- anterior (nesta função, na prática só existe 1 iteração pra
      -- esses dois casos hoje, já que v_total_parcelas só é setado pra
      -- 'parcelado' — o CASE deixa a regra explícita mesmo assim).
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
