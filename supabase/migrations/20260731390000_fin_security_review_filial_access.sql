-- ============================================================================
-- 3 achados de uma auditoria de segurança dedicada (não veio de review do
-- Codex — o usuário perdeu confiança no processo de review reativo depois
-- de mais de 100 rodadas nesta PR e pediu uma auditoria completa e
-- independente do diff inteiro contra main, feita por agentes com contexto
-- fresco, sem viés das minhas próprias conclusões anteriores). 2 dos 3
-- achados eram genuinamente NOVOS — nunca reportados em nenhuma rodada
-- anterior desta sessão.
--
-- 1. `fin_criar_transferencia` — `p_extras.filial_id` (que define a filial
--    da transferência e das 2 transações espelho) nunca passava por
--    `has_filial_access`, ao contrário das 2 CONTAS da mesma função (que
--    JÁ tinham o check, desde §9.74). Um tesoureiro restrito à filial B,
--    usando contas às quais tem acesso legítimo (pra passar nos checks de
--    conta), conseguia mandar `p_extras.filial_id` = UUID de outra filial
--    e gravar a transferência + as 2 transações nessa filial alheia, sem
--    NUNCA ter acesso checado contra ela.
--
-- 2. `fin_lancar_sessao` — `conta_id` de cada item (explícito ou resolvido
--    via `forma_pagamento_contas`) só era validado por `fin_validar_fk_
--    tenant` (tenant), nunca `has_filial_access`. Já documentado como
--    risco adiado (§11), mas esta PR reescreveu a função inteira
--    (`CREATE OR REPLACE`, migration 20260729130000, por outro motivo —
--    resolução de forma_pagamento_id) sem fechar o gap, violando a
--    própria regra do guardrail B.9 ("se já está reescrevendo, feche
--    agora"). Achado extra na mesma auditoria, ao ler a função inteira
--    pra montar este fix: `v_sessao.filial_id` (a filial da PRÓPRIA
--    sessão de contagem) também nunca era validada contra o chamador —
--    mesma classe do padrão "acesso à filial ATUAL do recurso" já usado
--    em `fin_atualizar_lancamento` (§9.74).
--
-- 3. `fin_recalcular_saldo_conta` — já estava na lista das "8 RPCs sem
--    has_filial_access" (risco mais sério documentado desde §9.68), mas
--    até esta PR só era alcançável via chamada direta da RPC (devtools/
--    script). Esta PR reescreveu a função por outro motivo (ajuste de
--    valor líquido, migration 20260730110000) sem fechar o gap, E deu a
--    ela o primeiro botão de verdade na UI (`Contas.tsx`, "Recalcular
--    Saldo") — sem NENHUM caminho de escrita novo (a UI já filtra a
--    listagem por filial), mas a RPC em si continua aceitando qualquer
--    `p_conta_id` do tenant, então uma chamada direta (fora do botão)
--    ainda sobrescreve `saldo_atual` de conta de qualquer filial. Não é
--    uma escrita NOVA-nova (a RPC sempre existiu), mas a PR tornou o
--    caminho de exploração muito mais descobrível sem fechar o gap.
--
-- Fix: `has_filial_access` na filial efetiva de cada recurso, mesmo
-- padrão já usado em todo o resto da sessão. Testado em harness Postgres
-- real (scratchpad harness_v30_*) com as 3 funções completas.
-- ============================================================================

-- ─── 1. fin_criar_transferencia ─────────────────────────────────────────────

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
    -- Achado de auditoria de segurança dedicada (não veio de review do
    -- Codex): v_filial nunca era validada contra o chamador — só as 2
    -- CONTAS abaixo tinham has_filial_access (§9.74). Mesmo padrão já
    -- usado em fin_criar_lancamento pro mesmo campo (p_extras.filial_id).
    IF v_filial IS NOT NULL AND (v_ctx ->> 'canal') = 'web'
       AND NOT public.has_filial_access(v_igreja, v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
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

-- ─── 2. fin_lancar_sessao ────────────────────────────────────────────────

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
  v_conta_filial uuid;
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

  -- Achado de auditoria de segurança dedicada: a filial da PRÓPRIA sessão
  -- nunca era validada contra o chamador — mesma classe do padrão "acesso
  -- à filial ATUAL do recurso" já usado em fin_atualizar_lancamento
  -- (§9.74). Sem isso, um tesoureiro restrito à filial B, sabendo (ou
  -- adivinhando) o id de uma sessão da filial A, conseguia lançar
  -- entradas na filial alheia.
  IF NOT public.has_filial_access(v_igreja, v_sessao.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial desta sessão';
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
    -- Achado de auditoria de segurança dedicada (não veio de review do
    -- Codex — já documentado como risco adiado em §11, mas esta função foi
    -- reescrita nesta PR por outro motivo sem fechar o gap, contrariando o
    -- guardrail B.9): conta_id só era validado por tenant, nunca filial.
    -- Um tesoureiro restrito à filial B, numa sessão da própria filial B,
    -- conseguia lançar item com conta_id de OUTRA filial, movendo saldo
    -- alheio.
    SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = v_conta;
    IF NOT public.has_filial_access(v_igreja, v_conta_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta selecionada';
    END IF;

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

-- ─── 3. fin_recalcular_saldo_conta ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_recalcular_saldo_conta(
  p_conta_id uuid,
  p_aplicar boolean DEFAULT false,
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
  v_conta public.contas%ROWTYPE;
  v_calculado numeric;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- FOR NO KEY UPDATE, não FOR UPDATE: compatível com o lock KEY SHARE que
  -- todo INSERT filho em transacoes_financeiras retém nesta linha (checagem
  -- da FK conta_id) até commitar — FOR UPDATE conflitaria com isso e abriria
  -- o mesmo risco de deadlock já corrigido em _fin_recalcular_saldo_conta_raw
  -- (achado do /code-review, mesmo padrão aplicado aqui por consistência).
  SELECT * INTO v_conta FROM public.contas
   WHERE id = p_conta_id AND igreja_id = v_igreja
   FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: conta % fora do tenant ou inexistente', p_conta_id;
  END IF;

  -- Achado de auditoria de segurança dedicada: já documentado desde §9.68
  -- como uma das "8 RPCs sem has_filial_access" (risco mais sério da
  -- sessão), mas até esta PR só era alcançável via chamada direta da RPC.
  -- Esta PR deu à função o primeiro botão de verdade na UI (Contas.tsx,
  -- "Recalcular Saldo") sem fechar o gap — qualquer tesoureiro, mesmo
  -- restrito a uma filial, conseguia sobrescrever saldo_atual de conta de
  -- QUALQUER filial do tenant via chamada direta da RPC (a UI só filtra a
  -- LISTAGEM por filial, não é um controle de acesso de verdade).
  IF NOT public.has_filial_access(v_igreja, v_conta.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial desta conta';
  END IF;

  SELECT COALESCE(v_conta.saldo_inicial, 0)
       + COALESCE(SUM(
           CASE WHEN tipo = 'entrada' THEN COALESCE(valor_liquido, valor)
                ELSE -COALESCE(valor_liquido, valor) END
         ), 0)
    INTO v_calculado
    FROM public.transacoes_financeiras
   WHERE conta_id = p_conta_id AND status = 'pago';

  IF p_aplicar THEN
    UPDATE public.contas
       SET saldo_atual = v_calculado, updated_at = now()
     WHERE id = p_conta_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_recalcular_saldo_conta', 'contas', p_conta_id,
    jsonb_build_object('aplicar', p_aplicar),
    jsonb_build_object('saldo_registrado', v_conta.saldo_atual,
                       'saldo_calculado', v_calculado));

  RETURN jsonb_build_object('ok', true, 'id', p_conta_id,
                            'saldo_registrado', v_conta.saldo_atual,
                            'saldo_calculado', v_calculado,
                            'aplicado', p_aplicar,
                            'warnings', '[]'::jsonb);
END;
$$;
