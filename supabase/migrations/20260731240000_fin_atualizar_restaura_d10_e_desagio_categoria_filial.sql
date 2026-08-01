-- ============================================================================
-- 2 achados do /code-review (PR #67, rodada de 01/08 19:29, commit revisado
-- 4898ccf), ambos reais:
--
-- 1) P1 — REGRESSÃO PRÓPRIA (não é um bug antigo, eu introduzi na rodada
--    anterior, §9.62): ao adicionar o guard de filial pro forma_pagamento_id
--    explícito em fin_atualizar_lancamento (20260731230000), usei como base
--    a versão de 20260729130000 — sem perceber que DUAS migrations
--    intermediárias já tinham corrigido essa mesma função:
--    20260729150000 (D10 — bloqueio FIN_COMPETENCIA_GRUPO, guarda contra
--    editar competência de uma parcela isolada num grupo parcelado) e
--    20260730100000 (reincorpora forma_pagamento_id + sinal de taxa, que o
--    replace do D10 tinha derrubado sem perceber — a MESMA classe de bug
--    que estou cometendo agora, documentada no próprio cabeçalho daquela
--    migration). Meu CREATE OR REPLACE apagou o bloqueio D10 de novo:
--    editar a competência de uma parcela isolada num grupo parcelado
--    voltou a suceder silenciosamente na linha, sem sincronizar as irmãs
--    nem passar por fin_alterar_competencia_grupo.
--
--    Fix: parte da versão MAIS RECENTE (20260730100000) como base — que já
--    tinha D4 + D10 + forma_pagamento_id + sinal de taxa — e adiciona só o
--    guard de filial do forma_pagamento_id explícito (§9.62) por cima,
--    sem tocar em mais nada. Lição: antes de qualquer CREATE OR REPLACE
--    numa função `fin_*`, `grep -rl "CREATE OR REPLACE FUNCTION public.
--    <nome>" supabase/migrations/*.sql | sort` pra achar a versão mais
--    recente de verdade, nunca reaproveitar uma cópia mental de uma leitura
--    anterior na mesma sessão — vira item novo no guardrail (seção B).
--
-- 2) P2 — fin_lancar_desagio_antecipacao: `p_categoria_id` só validado por
--    `fin_validar_fk_tenant` (tenant, não filial) — mesma classe dos
--    achados de §9.61/§9.62 (id explícito sem check de filial). Em "Todas
--    as filiais", `LancarDesagioDialog.tsx` listava categorias de TODAS as
--    filiais sem filtro (diferente da query de contas, logo acima no mesmo
--    arquivo, que já filtrava); escolher uma categoria de uma filial
--    específica enquanto a filial EFETIVA do lançamento (extrato, com
--    fallback pra conta) é outra cria uma transação referenciando metadado
--    privado de uma filial que ela não pertence.
--
--    Fix: RPC valida a filial da categoria contra a mesma filial EFETIVA já
--    calculada pro lançamento (extrato, com fallback pra conta — mesma
--    variável `v_filial_lancamento`, só movida pra ANTES da seleção da
--    categoria). Frontend: `categorias` ganha o mesmo filtro `.or(filial_id.
--    eq.X, filial_id.is.null)` que `contas` já tinha, usando exatamente o
--    mesmo sinal (`filialEfetivaLote`, com fallback pro contexto da view).
-- ============================================================================

-- ─── 1. fin_atualizar_lancamento — restaura D10, mantém o guard de filial ──

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

  -- D4: conciliado é imutável até desconciliar.
  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser editado (D4); desconcilie antes';
  END IF;

  -- D10 (20260729150000): parcela de lançamento parcelado não diverge de
  -- competência das irmãs sem ação explícita (use fin_alterar_competencia_
  -- grupo, ou passe _permitir_divergencia_competencia=true pra forçar uma
  -- exceção pontual). Restaurado aqui — tinha sido derrubado por engano no
  -- CREATE OR REPLACE anterior desta função (20260731230000, item 1 acima).
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
    -- §9.62: id explícito também respeita filial (global ou mesma filial
    -- efetiva da transação, nunca outra).
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

  -- Taxa administrativa reduz o que se RECEBE (entrada) e aumenta o que se
  -- PAGA (saída) — tipo efetivo é o do patch, senão o já gravado (§9.15).
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

COMMENT ON FUNCTION public.fin_atualizar_lancamento(uuid, jsonb, jsonb) IS
  'Atualiza lançamento (patch parcial): D4 bloqueia conciliado, D10 bloqueia divergir competência de parcela isolada num grupo parcelado, forma_pagamento_id (FK real, ADR-029) validado via fin_validar_fk_tenant + filial (global ou mesma filial efetiva) e sincronizado com o texto legado forma_pagamento.';

-- ─── 2. fin_lancar_desagio_antecipacao — categoria valida filial efetiva ───

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
  v_filial_lancamento uuid;
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

  SELECT id, valor, data_transacao, filial_id INTO v_extrato
    FROM public.extratos_bancarios WHERE id = v_lote.extrato_bancario_id;
  IF v_extrato.id IS NULL THEN
    RAISE EXCEPTION 'FIN_FK: extrato bancário vinculado ao lote não encontrado';
  END IF;

  SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;

  -- Checa acesso contra a filial EFETIVA: a do extrato quando ele tem uma;
  -- senão a da própria conta escolhida (§9.19).
  IF NOT public.has_filial_access(v_igreja, COALESCE(v_extrato.filial_id, v_conta_filial)) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lote/extrato';
  END IF;

  -- Filial efetiva do fluxo é a do EXTRATO vinculado, não a do lote em si
  -- (§9.19). Conta precisa concordar com essa filial quando ela existir;
  -- conta global (filial_id NULL) sempre aceita.
  IF v_extrato.filial_id IS NOT NULL
     AND v_conta_filial IS NOT NULL
     AND v_conta_filial IS DISTINCT FROM v_extrato.filial_id THEN
    RAISE EXCEPTION 'FIN_TENANT: conta selecionada pertence a outra filial (extrato vinculado é da filial %)', v_extrato.filial_id;
  END IF;

  -- Grava a filial real do dinheiro que se moveu: a do extrato bancário
  -- (fonte da verdade), com fallback pra filial da conta só se o extrato
  -- também for global — nunca mais o filial_id cru do lote (§9.19).
  -- Movida pra ANTES da seleção de categoria (era calculada só depois do
  -- cálculo do deságio) pra poder validar a categoria contra ela também.
  v_filial_lancamento := COALESCE(v_extrato.filial_id, v_conta_filial);

  SELECT tipo, filial_id INTO v_categoria FROM public.categorias_financeiras WHERE id = p_categoria_id;
  IF v_categoria.tipo <> 'saida' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: categoria informada não é de saída';
  END IF;
  -- fin_validar_fk_tenant só garante TENANT — não filial (§9.61/§9.62).
  -- "Todas as filiais" deixava escolher categoria de qualquer filial
  -- enquanto o lançamento nasce na filial EFETIVA do extrato/conta; se
  -- divergem, a transação fica referenciando metadado privado de uma
  -- filial diferente da sua própria (achado do /code-review).
  IF v_categoria.filial_id IS NOT NULL
     AND v_categoria.filial_id IS DISTINCT FROM v_filial_lancamento THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: categoria pertence a outra filial (lançamento é da filial %)', v_filial_lancamento;
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
      'filial_id', v_filial_lancamento
    ),
    v_ctx
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
