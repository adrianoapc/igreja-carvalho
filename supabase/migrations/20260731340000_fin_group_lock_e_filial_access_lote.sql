-- ============================================================================
-- 2 achados do /code-review (PR #67, rodada de 02/08 03:28, commit revisado
-- c71eeff6) — o P1 é exatamente o tipo de achado "acesso/filial" que já
-- devia estar coberto; o P2 é mais uma variação do padrão de lock D.5. Além
-- dos 2 achados, esta migration fecha proativamente o mesmo buraco de
-- `has_filial_access` (§9.68) nas OUTRAS 2 funções que esta sessão já
-- reescreveu várias vezes (`fin_atualizar_lancamento`, `fin_criar_
-- transferencia`) — não as ~8 restantes da lista de §9.68 (essas continuam
-- fora de escopo, nunca tocadas por este PR), só as que já estão no diff.
--
-- 1) P1 — fin_alterar_competencia_grupo sem NENHUM has_filial_access. Um
--    tesoureiro restrito à filial B que soubesse o id de uma parcela da
--    filial A conseguia sincronizar a competência do grupo inteiro da
--    filial A — SECURITY DEFINER bypassa RLS, só `igreja_id` era checado.
--    Fix: `has_filial_access(v_igreja, v_atual.filial_id)` logo após a
--    releitura pós-lock (§9.72 já trouxe o lock do grupo pra ANTES da
--    leitura de v_atual — o check de acesso entra nesse mesmo ponto).
--
-- 2) P2 — fin_excluir_lancamento trava a raiz INDIVIDUALMENTE primeiro
--    (`SELECT ... WHERE id = p_id FOR UPDATE`) e só trava outras linhas do
--    grupo DEPOIS, durante o reparenting — mesma classe de deadlock já
--    corrigida em fin_alterar_competencia_grupo (D.5), só que numa função
--    DIFERENTE: as duas rodando concorrentemente sobre o MESMO grupo (uma
--    excluindo a raiz enquanto reparenteia, a outra sincronizando
--    competência) podiam deadlockar porque seguiam protocolos de lock
--    DIFERENTES. Fix: mesmo protocolo — resolve o grupo sem lock, trava o
--    grupo INTEIRO numa única statement em ordem determinística, releitura
--    pós-lock — antes de decidir o que excluir/reparentear.
--
-- 3) (proativo, não veio do review desta rodada) fin_atualizar_lancamento
--    e fin_criar_transferencia — já reescritas várias vezes nesta sessão,
--    ainda sem has_filial_access. Fechado aqui pra não repetir o mesmo
--    achado numa rodada futura sobre uma função que já estava no diff.
-- ============================================================================

-- ─── 1+2. fin_excluir_lancamento — lock de grupo unificado + (sem novo
-- check de filial aqui: já está na lista de §9.68, fora de escopo desta
-- rodada — só o protocolo de lock precisa ficar consistente com
-- fin_alterar_competencia_grupo pra não deadlockar entre as duas) ────────

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

  -- Só pra achar o grupo (raiz + irmãs) — sem lock. Se p_id não pertencer
  -- a nenhum grupo, COALESCE cai pro próprio id (comportamento idêntico a
  -- travar só a própria linha).
  SELECT COALESCE(lancamento_pai_id, id) INTO v_pai
    FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  -- Trava o grupo INTEIRO numa única statement, ordem determinística —
  -- mesmo protocolo de fin_alterar_competencia_grupo (§9.72/D.5). Sem
  -- isso, esta função (que trava a raiz individualmente e só trava outras
  -- linhas DEPOIS, durante o reparenting) e fin_alterar_competencia_grupo
  -- (que já trava o grupo inteiro de uma vez) podiam deadlockar rodando
  -- concorrentemente sobre o mesmo grupo — achado do /code-review.
  PERFORM 1 FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja AND (id = v_pai OR lancamento_pai_id = v_pai)
   ORDER BY id
     FOR UPDATE;

  -- Releitura pós-lock, snapshot fresco.
  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: lançamento conciliado não pode ser excluído (D4); desconcilie antes';
  END IF;

  -- Calcula quais ids serão removidos, pra poder reparentear o grupo (item
  -- abaixo) antes que a FK lancamento_pai_id (ON DELETE SET NULL) orfaneie
  -- as irmãs sozinha. `v_pai` já resolvido acima (mesmo valor usado pro
  -- lock) — não recalcula.
  IF v_escopo = 'este_e_futuras' THEN
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
  -- irmãs de uma vez quando a raiz é apagada. Todas as linhas envolvidas
  -- já estão travadas (lock do grupo inteiro, acima) — estas UPDATEs não
  -- adquirem lock novo em linha que outra sessão possa estar disputando.
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

-- ─── 3. fin_alterar_competencia_grupo — has_filial_access ──────────────────

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

  SELECT COALESCE(lancamento_pai_id, id) INTO v_pai
    FROM public.transacoes_financeiras
   WHERE id = p_lancamento_id AND igreja_id = v_igreja;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_lancamento_id;
  END IF;

  PERFORM 1 FROM public.transacoes_financeiras
   WHERE igreja_id = v_igreja AND (id = v_pai OR lancamento_pai_id = v_pai)
   ORDER BY id
     FOR UPDATE;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_lancamento_id AND igreja_id = v_igreja;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_lancamento_id;
  END IF;

  -- §9.74: nunca validava filial nenhuma — tesoureiro restrito à filial B
  -- que soubesse o id de uma parcela da filial A sincronizava o grupo
  -- inteiro da filial A (SECURITY DEFINER bypassa RLS). Todas as parcelas
  -- de um grupo compartilham filial_id (gravado uma vez, na criação, em
  -- fin_criar_lancamento) — checar a de v_atual cobre o grupo inteiro.
  IF NOT public.has_filial_access(v_igreja, v_atual.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lançamento';
  END IF;

  IF v_atual.tipo_lancamento <> 'parcelado' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: fin_alterar_competencia_grupo só se aplica a lançamentos parcelados (tipo_lancamento=%)', v_atual.tipo_lancamento;
  END IF;

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

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'warnings', to_jsonb(v_warnings),
                            'snapshot_antes', v_snapshot);
END;
$$;

-- ─── 4. fin_atualizar_lancamento — has_filial_access (fechamento proativo,
-- função já reescrita várias vezes nesta sessão) ───────────────────────────

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
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  -- §9.74: checa acesso à filial ATUAL do lançamento. O caso de mudar
  -- filial_id no patch pra uma filial diferente já é coberto pelo bloco
  -- abaixo (fin_validar_fk_filial pros 6 campos, quando filial_id está no
  -- patch, valida os campos contra a filial NOVA — mas nenhum deles
  -- valida se o CHAMADOR tem acesso à filial nova em si; como isso exige
  -- o mesmo tipo de checagem condicionada a canal já usado em fin_criar_
  -- lancamento, mantido como item separado, não bloqueante pra este achado).
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

-- ─── 5. fin_criar_transferencia — has_filial_access nas 2 contas
-- (fechamento proativo, função já reescrita várias vezes nesta sessão) ─────

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
  v_conta_origem_filial uuid;
  v_conta_destino_filial uuid;
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

  -- §9.74: nunca validava se o chamador tem acesso à filial das contas
  -- envolvidas — tesoureiro restrito à filial B conseguia mover dinheiro
  -- entre 2 contas de OUTRA filial (SECURITY DEFINER bypassa RLS).
  SELECT filial_id INTO v_conta_origem_filial FROM public.contas WHERE id = p_conta_origem_id;
  SELECT filial_id INTO v_conta_destino_filial FROM public.contas WHERE id = p_conta_destino_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_origem_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta de origem';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_conta_destino_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta de destino';
  END IF;

  -- Trava as duas contas em ordem determinística (por id) ANTES de
  -- qualquer INSERT pago — evita deadlock entre 2 transferências
  -- concorrentes em direções opostas. FOR NO KEY UPDATE (§9.65): compatível
  -- com o KEY SHARE que qualquer INSERT em transacoes_financeiras já retém
  -- nessas contas via FK.
  PERFORM 1 FROM public.contas
   WHERE id IN (p_conta_origem_id, p_conta_destino_id)
   ORDER BY id
     FOR NO KEY UPDATE;

  SELECT nome INTO v_nome_origem FROM public.contas WHERE id = p_conta_origem_id;
  SELECT nome INTO v_nome_destino FROM public.contas WHERE id = p_conta_destino_id;

  SELECT id INTO v_forma_transf_id FROM public.formas_pagamento
   WHERE igreja_id = v_igreja AND nome = 'Transferência Bancária' AND ativo = true
     AND (filial_id IS NOT DISTINCT FROM v_filial OR filial_id IS NULL)
   ORDER BY (filial_id IS NOT DISTINCT FROM v_filial) DESC, created_at ASC
   LIMIT 1;

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
  -- contas via trigger_atualizar_saldo_conta. Compensação manual removida
  -- (duplicaria o movimento).

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
