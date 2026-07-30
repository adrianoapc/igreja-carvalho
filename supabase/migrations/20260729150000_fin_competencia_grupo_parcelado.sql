-- ============================================================================
-- D10 — Competência de grupo em lançamentos parcelados (ADR-029)
--
-- Contexto: fin_criar_lancamento (D6) já materializa todas as parcelas de um
-- lançamento parcelado com a MESMA data_competencia (fato gerador único —
-- ex.: equipamento comprado em 10x mantém a competência do mês da compra em
-- todas as parcelas, para o DRE por competência não diluir a decisão
-- econômica ao longo de vários meses). O gap fechado aqui é a EDIÇÃO: até
-- esta migration, fin_atualizar_lancamento fazia UPDATE só na linha
-- editada — mudar a competência de uma parcela do meio não propagava para
-- as irmãs (mesmo lancamento_pai_id), quebrando a consistência do grupo
-- silenciosamente.
--
-- Decisão: bloquear a edição individual de data_competencia num lançamento
-- parcelado (erro nomeado FIN_COMPETENCIA_GRUPO) + nova RPC explícita
-- fin_alterar_competencia_grupo que sincroniza TODAS as parcelas numa única
-- transação. Não propaga automaticamente porque fin_atualizar_lancamento é
-- genérico e o frontend sempre inclui data_competencia no patch (mesmo
-- quando a intenção é só editar outro campo) — propagar sem intenção
-- explícita arriscaria alterar em massa por engano.
--
-- Regra restrita a tipo_lancamento='parcelado'. Recorrência
-- (tipo_lancamento='recorrente') mantém competência própria por ocorrência
-- (ex.: aluguel mensal) e não é afetada por este bloqueio.
-- ============================================================================

-- ─── 1. fin_atualizar_lancamento — bloqueio D10 ─────────────────────────────

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

  -- D10: parcela de lançamento parcelado não diverge de competência das
  -- irmãs sem ação explícita (use fin_alterar_competencia_grupo, ou passe
  -- _permitir_divergencia_competencia=true para forçar uma exceção pontual
  -- — ex.: renegociação que reagenda só uma parcela).
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
      -- flag de controle (D10), não é campo de dado; não aplica nem avisa.
      NULL;
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

  -- ADR-027: recalcula valor_liquido quando componentes mudam sem fixação explícita.
  IF NOT (v_aplicar ? 'valor_liquido')
     AND (v_aplicar ?| ARRAY['valor','juros','multas','desconto','taxas_administrativas']) THEN
    v_aplicar := v_aplicar || jsonb_build_object('valor_liquido',
        COALESCE((v_aplicar ->> 'valor')::numeric, v_atual.valor)
      + COALESCE((v_aplicar ->> 'juros')::numeric, v_atual.juros, 0)
      + COALESCE((v_aplicar ->> 'multas')::numeric, v_atual.multas, 0)
      + COALESCE((v_aplicar ->> 'taxas_administrativas')::numeric, v_atual.taxas_administrativas, 0)
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

-- ─── 2. fin_alterar_competencia_grupo ───────────────────────────────────────
-- Sincroniza data_competencia de TODAS as parcelas de um lançamento
-- parcelado numa única transação. Contrapartida do bloqueio acima.

CREATE OR REPLACE FUNCTION public.fin_alterar_competencia_grupo(
  p_lancamento_id uuid,
  p_nova_competencia date,
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
  v_pai uuid;
  v_ids uuid[];
  v_conciliadas uuid[];
  v_pagas int;
  v_warnings text[] := '{}';
  v_snapshot jsonb;
BEGIN
  IF p_nova_competencia IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: nova competência é obrigatória';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_lancamento_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_lancamento_id;
  END IF;

  IF v_atual.tipo_lancamento <> 'parcelado' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: fin_alterar_competencia_grupo só se aplica a lançamentos parcelados (tipo_lancamento=%)', v_atual.tipo_lancamento;
  END IF;

  v_pai := COALESCE(v_atual.lancamento_pai_id, v_atual.id);

  -- Trava do grupo inteiro, evitando corrida com outra edição concorrente.
  PERFORM 1 FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja AND (id = v_pai OR lancamento_pai_id = v_pai)
   FOR UPDATE;

  SELECT array_agg(id) INTO v_conciliadas
    FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja
     AND (id = v_pai OR lancamento_pai_id = v_pai)
     AND conciliacao_status IN ('conciliado_extrato','conciliado_bot');

  IF v_conciliadas IS NOT NULL AND array_length(v_conciliadas, 1) > 0 THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: % parcela(s) do grupo já conciliada(s) (%); desconcilie antes de sincronizar a competência',
      array_length(v_conciliadas, 1), array_to_string(v_conciliadas, ', ');
  END IF;

  SELECT jsonb_agg(jsonb_build_object('id', id, 'data_competencia', data_competencia))
    INTO v_snapshot
    FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja
     AND (id = v_pai OR lancamento_pai_id = v_pai);

  SELECT count(*) INTO v_pagas
    FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja
     AND (id = v_pai OR lancamento_pai_id = v_pai)
     AND status = 'pago';

  WITH upd AS (
    UPDATE public.transacoes_financeiras
       SET data_competencia = p_nova_competencia, updated_at = now()
     WHERE igreja_id = v_igreja
       AND (id = v_pai OR lancamento_pai_id = v_pai)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_ids FROM upd;

  IF v_pagas > 0 THEN
    v_warnings := v_warnings ||
      format('%s parcela(s) já paga(s) tiveram a competência alterada; revise o DRE por competência do(s) período(s) afetado(s)', v_pagas);
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_alterar_competencia_grupo', 'transacoes_financeiras', v_pai,
    jsonb_build_object('nova_competencia', p_nova_competencia, 'snapshot_antes', v_snapshot),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── 3. Grants ───────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.fin_alterar_competencia_grupo(uuid, date, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_alterar_competencia_grupo(uuid, date, jsonb) FROM anon;
