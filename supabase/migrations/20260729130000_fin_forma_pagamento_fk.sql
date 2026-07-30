-- ============================================================================
-- forma_pagamento_id: FK real (ADR-029) — corrige a causa raiz encontrada ao
-- planejar a "conferência de totais" da Fase B do Recebível Getnet.
--
-- `transacoes_financeiras.forma_pagamento` sempre foi texto solto, nunca uma
-- FK de verdade. 4 escritores gravavam formatos incompatíveis:
--   · fin_lancar_sessao / TransacaoDialog.tsx → formas_pagamento.id::text
--     (válido, mas como TEXTO — nenhum outro leitor sabia disso com certeza)
--   · fin_pagar_reembolso → 'pix'|'dinheiro'|'transferencia' (vocabulário de
--     solicitacoes_reembolso.forma_pagamento_preferida, CHECK próprio)
--   · fin_criar_transferencia → string fixa 'Transferência Bancária'
--   · chatbot-financeiro (edge function) → rótulo em Português exato
--     ('Dinheiro'/'PIX'/'Cartão de Crédito'/'Boleto Bancário'), batendo por
--     coincidência com formas_pagamento.nome, nunca com o id
-- Consequência real (não hipotética): fin_ofertas_periodo só resolvia nome
-- pras linhas com UUID; isPagamentoDinheiro (frontend) só batia pras linhas
-- com rótulo; a tela de edição de transação perdia o valor original ao
-- reabrir linhas gravadas por bot/reembolso (Select não achava o item).
--
-- Escopo desta migration: coluna nova `forma_pagamento_id uuid` (mantém a
-- coluna texto antiga — ainda é a única fonte de verdade pra
-- fin_pagar_reembolso/fin_criar_transferencia, que ficam FORA de escopo
-- aqui: vocabulário de preferência de pagamento é conceitualmente diferente
-- de "qual formas_pagamento foi usado"), backfill tenant-scoped em 2 passes,
-- e os escritores/leitores que devem passar a usar a coluna nova.
-- ============================================================================

-- ─── 1. Coluna nova + índice ────────────────────────────────────────────────

ALTER TABLE public.transacoes_financeiras
  ADD COLUMN IF NOT EXISTS forma_pagamento_id uuid REFERENCES public.formas_pagamento(id);

CREATE INDEX IF NOT EXISTS idx_transacoes_forma_pagamento_id
  ON public.transacoes_financeiras(forma_pagamento_id);

COMMENT ON COLUMN public.transacoes_financeiras.forma_pagamento_id IS
  'FK real pra formas_pagamento (ADR-029). Coluna forma_pagamento (text) mantida como legado/fallback de exibição e pros escritores fora de escopo (fin_pagar_reembolso, fin_criar_transferencia parcialmente).';

-- ─── 2. Backfill tenant-scoped em 2 passes ──────────────────────────────────
-- Sem recorte por igreja_id seria um bug cross-tenant real: formas_pagamento
-- não tem UNIQUE(igreja_id, nome), então IGREJAS DIFERENTES podem ter uma
-- forma "PIX" cada — casar pelo nome sem travar por igreja_id misturaria
-- tenants.

DO $$
DECLARE
  v_n1 int;
  v_n2 int;
  v_total int;
  v_mapeado int;
  v_nao_mapeado int;
BEGIN
  -- (a) UUID-como-texto (fin_lancar_sessao, TransacaoDialog.tsx). Regex
  -- OBRIGATÓRIO: 'Dinheiro'::uuid explode a migration inteira sem essa guarda.
  UPDATE public.transacoes_financeiras t
     SET forma_pagamento_id = fp.id
    FROM public.formas_pagamento fp
   WHERE t.forma_pagamento_id IS NULL
     AND t.forma_pagamento ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND fp.igreja_id = t.igreja_id
     AND fp.id = t.forma_pagamento::uuid;
  GET DIAGNOSTICS v_n1 = ROW_COUNT;

  -- (b) rótulo, case-insensitive — cobre tanto o rótulo exato do bot
  -- ('Dinheiro') quanto o minúsculo herdado de reembolso/legado ('dinheiro')
  -- numa query só. DISTINCT ON desempata determinístico pro caso raro de
  -- nome duplicado na mesma igreja (sem UNIQUE constraint pra impedir).
  UPDATE public.transacoes_financeiras t
     SET forma_pagamento_id = fp.id
    FROM (
      SELECT DISTINCT ON (igreja_id, lower(nome)) id, igreja_id, nome
        FROM public.formas_pagamento
       ORDER BY igreja_id, lower(nome), ativo DESC, created_at ASC
    ) fp
   WHERE t.forma_pagamento_id IS NULL
     AND fp.igreja_id = t.igreja_id
     AND lower(t.forma_pagamento) = lower(fp.nome);
  GET DIAGNOSTICS v_n2 = ROW_COUNT;

  SELECT count(*) FILTER (WHERE forma_pagamento IS NOT NULL),
         count(*) FILTER (WHERE forma_pagamento IS NOT NULL AND forma_pagamento_id IS NOT NULL),
         count(*) FILTER (WHERE forma_pagamento IS NOT NULL AND forma_pagamento_id IS NULL)
    INTO v_total, v_mapeado, v_nao_mapeado
    FROM public.transacoes_financeiras;

  RAISE NOTICE 'forma_pagamento backfill: uuid-texto=%, rotulo=%, total_com_texto=%, mapeado=%, nao_mapeado=%',
    v_n1, v_n2, v_total, v_mapeado, v_nao_mapeado;
END $$;

-- ─── 3. fin_criar_lancamento ────────────────────────────────────────────────
-- Aceita p_extras.forma_pagamento_id (validado via fin_validar_fk_tenant —
-- antes um id de OUTRO TENANT passava batido, hoje é um FIN_FK real).
-- Sem id explícito, resolve por rótulo (mesma lógica do backfill passo b) —
-- cobre o chatbot sem precisar tocar na edge function. Grava as duas
-- colunas: forma_pagamento_id (FK) e forma_pagamento (nome resolvido, não
-- mais o texto cru repassado sem validação).

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
  -- PAGA (saída) — ver 20260728170000.
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

  v_forma_id := NULLIF(p_extras ->> 'forma_pagamento_id', '')::uuid;
  PERFORM public.fin_validar_fk_tenant('formas_pagamento', v_forma_id, v_igreja);
  IF v_forma_id IS NOT NULL THEN
    SELECT nome INTO v_forma_nome FROM public.formas_pagamento WHERE id = v_forma_id;
  ELSIF NULLIF(p_extras ->> 'forma_pagamento', '') IS NOT NULL THEN
    -- Sem id explícito: resolve por rótulo (chatbot manda nome exato;
    -- legado pode mandar minúsculo) — mesma lógica do backfill passo (b).
    SELECT id, nome INTO v_forma_id, v_forma_nome
      FROM public.formas_pagamento
     WHERE igreja_id = v_igreja
       AND lower(nome) = lower(p_extras ->> 'forma_pagamento')
     ORDER BY ativo DESC, created_at ASC
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

-- ─── 4. fin_atualizar_lancamento ────────────────────────────────────────────
-- forma_pagamento_id entra na allow-list de patch, validado via
-- fin_validar_fk_tenant. Quando o patch traz forma_pagamento_id, a coluna
-- texto legada é resolvida junto (nome da forma) — não fica dessincronizada.

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
  PERFORM public.fin_validar_fk_tenant('formas_pagamento', NULLIF(v_aplicar ->> 'forma_pagamento_id','')::uuid, v_igreja);

  IF v_aplicar ? 'forma_pagamento_id' THEN
    SELECT nome INTO v_forma_nome FROM public.formas_pagamento
     WHERE id = NULLIF(v_aplicar ->> 'forma_pagamento_id','')::uuid;
  END IF;

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

-- ─── 5. fin_lancar_sessao ───────────────────────────────────────────────────
-- Já resolvia/validava v_forma com tenant check próprio (mais estrito que
-- fin_validar_fk_tenant) — só passa a gravar forma_pagamento_id também.

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
      conta_id, categoria_id, forma_pagamento, forma_pagamento_id, taxas_administrativas,
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
      v_forma.id,
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

-- ─── 6. fin_criar_transferencia ─────────────────────────────────────────────
-- Melhoria pontual de baixo risco: resolve a string fixa 'Transferência
-- Bancária' contra formas_pagamento da igreja e grava forma_pagamento_id
-- quando achar. Não regride nada — hoje já fica sem match nenhum.

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

  -- Semântica canônica (do bot): transferência move saldo imediatamente.
  -- O trigger de saldo não dispara em INSERT, então o ajuste é explícito.
  UPDATE public.contas SET saldo_atual = saldo_atual - p_valor, updated_at = now()
   WHERE id = p_conta_origem_id;
  UPDATE public.contas SET saldo_atual = saldo_atual + p_valor, updated_at = now()
   WHERE id = p_conta_destino_id;

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

-- ─── 7. fin_ofertas_periodo ──────────────────────────────────────────────────
-- Join sem cast (::text não é mais necessário). RETURNS TABLE muda de tipo
-- (text→uuid) — Postgres recusa em CREATE OR REPLACE, precisa DROP antes.

DROP FUNCTION IF EXISTS public.fin_ofertas_periodo(date, date, uuid);

CREATE FUNCTION public.fin_ofertas_periodo(
  p_inicio date,
  p_fim date,
  p_filial_id uuid DEFAULT NULL
)
RETURNS TABLE(
  dia date,
  forma_pagamento_id uuid,
  forma_nome text,
  conta_nome text,
  total numeric,
  quantidade bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_igreja uuid := public.fin_exigir_leitura_financeira(p_filial_id);
BEGIN
  RETURN QUERY
  SELECT t.data_vencimento AS dia,
         t.forma_pagamento_id AS forma_pagamento_id,
         COALESCE(fp.nome, 'Não especificado') AS forma_nome,
         COALESCE(c.nome, 'Sem conta') AS conta_nome,
         COALESCE(SUM(t.valor), 0) AS total,
         COUNT(*) AS quantidade
    FROM public.transacoes_financeiras t
    LEFT JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
    LEFT JOIN public.contas c ON c.id = t.conta_id
    LEFT JOIN public.categorias_financeiras cat ON cat.id = t.categoria_id
   WHERE t.igreja_id = v_igreja
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.data_vencimento BETWEEN p_inicio AND p_fim
     AND (p_filial_id IS NULL OR t.filial_id = p_filial_id)
     -- Filtro ESTRUTURAL: sessão de contagem ou categoria de oferta/dízimo
     -- (substitui ilike em descricao, que dependia de texto livre)
     AND (
       t.sessao_id IS NOT NULL
       OR cat.nome ILIKE '%oferta%'
       OR cat.nome ILIKE '%d_zimo%'
     )
   GROUP BY t.data_vencimento, t.forma_pagamento_id, fp.nome, c.nome
   ORDER BY t.data_vencimento;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_ofertas_periodo(date, date, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.fin_ofertas_periodo(date, date, uuid) FROM anon;

-- ─── 8. Escopo explicitamente fora desta migration ─────────────────────────
-- fin_pagar_reembolso: continua só no texto — 'pix'|'dinheiro'|'transferencia'
-- é vocabulário de PREFERÊNCIA (solicitacoes_reembolso.forma_pagamento_
-- preferida, CHECK próprio), conceito diferente de "qual formas_pagamento
-- foi usado". chatbot-financeiro (edge function): não precisou mudar —
-- fin_criar_lancamento agora resolve o rótulo que o bot já mandava.
