-- ADR-033 / PR2a-2 do fatiamento em PRs empilhadas (docs/automacoes/
-- PLANO_REMOCAO_MAKE_WHATSAPP.md §Passo 1, item de idempotência #5 —
-- "propagar wamid até as RPCs canônicas fin_* chamadas por
-- criarLancamento/criarTransferencia... mesmo padrão de conflito-de-
-- unicidade = já processado, retorna resultado anterior"). Deferida
-- explicitamente da PR2a-1 (whatsapp_chatbot_wamid_claim,
-- 20260901000000): aquela é idempotência de ENTRADA HTTP (o chatbot
-- responde de novo sem reprocessar); esta é idempotência de LEDGER —
-- defesa em profundidade se a PR2a-1 falhar em marcar completed depois
-- de já ter criado o lançamento (crash entre os 2 pontos), um retry
-- não duplica dinheiro. Nenhuma substitui a outra.
--
-- Aditivo/dark: wamid/item_key só chegam preenchidos quando o caller
-- manda `p_extras.wamid` — nenhum caller mandava antes desta PR.
-- chatbot-financeiro/index.ts JÁ propaga wamid/item_key pras chamadas
-- de criarLancamento (fluxo DESPESAS/CONTA_UNICA)/criarTransferencia
-- (mesma PR, commit irmão deste migration). Sem wamid, `INSERT` roda
-- exatamente como antes — os índices únicos novos são parciais (`WHERE
-- wamid IS NOT NULL`), não tocam nenhuma row existente.
--
-- **Terceiro fluxo (reembolso) DELIBERADAMENTE fora do escopo desta
-- PR** — o plano original (Passo 1, item 5) pede o mesmo guard em
-- `solicitacoes_reembolso`, mas esse fluxo escreve direto na tabela
-- (sem RPC fin_*) e tem efeitos colaterais com estado próprio
-- (notificação a tesoureiros via disparar-alerta, fechamento de sessão)
-- que uma retentativa não pode disparar de novo — replay correto exige
-- pular o loop de itens E a notificação inteiros no conflito, não só
-- recuperar 1 id como as 2 RPCs acima. Fica pra PR2a-3, sessão dedicada
-- (mesmo racional de fatiamento das PRs anteriores — não emendar mais
-- uma peça de escopo/risco diferente numa PR já grande o suficiente).
--
-- `criarLancamento` roda em LOOP (1 chamada por item de comprovante,
-- ver chatbot-financeiro/index.ts) — um wamid cru não serve de chave
-- única sozinho (rejeitaria o 2º item em diante, ou duplicaria numa
-- retentativa no meio do loop). Chave composta (wamid, item_key,
-- numero_parcela) — item_key desempata itens do mesmo wamid,
-- numero_parcela desempata parcelas do MESMO item (parcelamento roda
-- em sub-loop dentro de uma única chamada). `NULLS NOT DISTINCT`
-- porque numero_parcela é NULL pra lançamento "unico"/"recorrente" —
-- sem isso, 2 chamadas do mesmo wamid+item_key com numero_parcela NULL
-- não colidiriam (NULL <> NULL em unicidade padrão), reabrindo o
-- próprio buraco que este índice existe pra fechar.
--
-- `criarTransferencia` é uma chamada só (nunca em loop) — wamid sozinho
-- já é chave suficiente em transferencias_contas. As 2 pernas em
-- transacoes_financeiras (saída/entrada) reaproveitam as MESMAS 2
-- colunas novas (não uma tabela paralela), com item_key='saida'/
-- 'entrada' pra não colidirem entre si sob o mesmo índice único de
-- transacoes_financeiras (as 2 têm numero_parcela NULL — sem
-- item_key diferenciando, o NULLS NOT DISTINCT faria a 2ª perna
-- "colidir" com a 1ª e a idempotência ficaria mal desenhada).

-- ─── Schema: 2 colunas novas + 2 índices únicos parciais ──────────────

ALTER TABLE public.transacoes_financeiras
  ADD COLUMN IF NOT EXISTS wamid TEXT,
  ADD COLUMN IF NOT EXISTS wamid_item_key TEXT;

COMMENT ON COLUMN public.transacoes_financeiras.wamid IS
  'Idempotência de ledger (ADR-033 PR2a-2) — message_id da Meta que '
  'originou este lançamento via WhatsApp. NULL pra todo o resto '
  '(lançamentos manuais/web/outras integrações).';
COMMENT ON COLUMN public.transacoes_financeiras.wamid_item_key IS
  'Desempate dentro do mesmo wamid: índice/id do item de comprovante '
  '(fluxo DESPESAS, loop de itens) ou "saida"/"entrada" (perna de '
  'fin_criar_transferencia). NULL quando wamid é NULL.';

-- igreja_id na chave (achado real de /security-review local): sem isso,
-- um wamid reusado/colidido sob OUTRO igreja_id (bug de roteamento no
-- Make, ou body.igreja_id explícito de um tenant diferente — ver
-- resolverIgrejaEFilialWhatsApp) faria o fallback de "já processado"
-- recuperar silenciosamente o id de OUTRO tenant em vez de estourar
-- FIN_INCONSISTENTE. Não é escalonamento de privilégio (quem chega aqui
-- já validou fin_resolver_contexto/has_filial_access pro próprio
-- igreja_id), mas é o padrão de isolamento por tenant que este projeto
-- trata como regra de ouro (CLAUDE.md) — mais barato fechar agora do
-- que depois.
CREATE UNIQUE INDEX IF NOT EXISTS transacoes_financeiras_wamid_item_parcela_key
ON public.transacoes_financeiras (igreja_id, wamid, wamid_item_key, numero_parcela)
NULLS NOT DISTINCT
WHERE wamid IS NOT NULL;

ALTER TABLE public.transferencias_contas
  ADD COLUMN IF NOT EXISTS wamid TEXT;

COMMENT ON COLUMN public.transferencias_contas.wamid IS
  'Idempotência de ledger (ADR-033 PR2a-2) — message_id da Meta que '
  'originou esta transferência via WhatsApp. NULL pro resto.';

CREATE UNIQUE INDEX IF NOT EXISTS transferencias_contas_wamid_key
ON public.transferencias_contas (igreja_id, wamid)
WHERE wamid IS NOT NULL;

-- ─── fin_criar_lancamento ──────────────────────────────────────────────
-- Corpo inteiro via CREATE OR REPLACE (guardrail 6b, docs/guardrails-
-- financeiro.md — editar o migration histórico não republica o corpo
-- no próximo `supabase db push`; fonte anterior confirmada como a mais
-- recente: 20260731380000_fin_lancamento_conta_id_filial_access.sql).
-- Assinatura idêntica (mesmos p_* na mesma ordem) — grants de
-- 20260819160000_fecha_grant_public_anon_fin_functions.sql continuam
-- válidos, sem precisar de REVOKE/GRANT novo.

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
  v_wamid text;
  v_item_key text;
  v_numero_parcela_atual int;
  v_algum_novo boolean := false;
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

  -- Idempotência de ledger (ADR-033 PR2a-2) — ausente = comportamento
  -- 100% idêntico ao anterior a esta migration (índice único é parcial,
  -- WHERE wamid IS NOT NULL).
  v_wamid := NULLIF(p_extras ->> 'wamid', '');
  v_item_key := NULLIF(p_extras ->> 'item_key', '');

  FOR v_parcela IN 1 .. COALESCE(v_total_parcelas, 1) LOOP
    v_venc := p_data_vencimento + make_interval(months => v_parcela - 1);
    v_numero_parcela_atual := CASE WHEN v_tipo_lancamento = 'parcelado' THEN v_parcela ELSE NULL END;

    INSERT INTO public.transacoes_financeiras (
      tipo, tipo_lancamento, descricao, valor, valor_liquido,
      data_vencimento, data_competencia, data_pagamento,
      conta_id, categoria_id, subcategoria_id, centro_custo_id,
      base_ministerial_id, fornecedor_id, forma_pagamento, forma_pagamento_id,
      total_parcelas, numero_parcela, recorrencia, data_fim_recorrencia,
      observacoes, anexo_url, lancado_por, status,
      juros, multas, desconto, taxas_administrativas,
      pessoa_id, sessao_id, solicitacao_reembolso_id,
      origem_registro, lancamento_pai_id, igreja_id, filial_id,
      wamid, wamid_item_key
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
      v_numero_parcela_atual,
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
      v_pai, v_igreja, v_filial,
      v_wamid, v_item_key
    )
    ON CONFLICT (igreja_id, wamid, wamid_item_key, numero_parcela) WHERE (wamid IS NOT NULL)
    DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
      v_algum_novo := true;
    END IF;

    IF v_id IS NULL AND v_wamid IS NOT NULL THEN
      -- Conflito = já processado (retentativa do mesmo wamid/item/parcela)
      -- — idempotência, não erro: recupera o id já criado em vez de
      -- duplicar o lançamento. igreja_id no WHERE (achado real de
      -- /security-review local): sem isso, um wamid colidido sob OUTRO
      -- tenant recuperaria silenciosamente o id de outra igreja em vez
      -- de estourar FIN_INCONSISTENTE.
      SELECT id INTO v_id FROM public.transacoes_financeiras
       WHERE igreja_id = v_igreja
         AND wamid = v_wamid
         AND wamid_item_key IS NOT DISTINCT FROM v_item_key
         AND numero_parcela IS NOT DISTINCT FROM v_numero_parcela_atual;
      IF v_id IS NULL THEN
        RAISE EXCEPTION 'FIN_INCONSISTENTE: conflito de idempotência sem row correspondente (igreja_id=%, wamid=%, item_key=%, parcela=%)',
          v_igreja, v_wamid, v_item_key, v_numero_parcela_atual;
      END IF;
    END IF;

    IF v_parcela = 1 THEN v_pai := v_id; END IF;
    v_ids := v_ids || v_id;
  END LOOP;

  IF v_total_parcelas IS NOT NULL AND v_total_parcelas > 1 THEN
    v_warnings := v_warnings ||
      format('Materializadas %s parcelas mensais a partir de %s (D6)', v_total_parcelas, p_data_vencimento);
  END IF;

  -- 'idempotente' = true só quando NENHUM item do loop foi inserido de
  -- fato (todos recuperados por conflito) — mesmo tratamento de
  -- fin_criar_transferencia (achado real de /code-review local, 2
  -- ângulos independentes): sem isso, uma retentativa 100% idempotente
  -- ainda grava um audit log como se tivesse "criado" o lançamento de
  -- novo, confundindo quem reconcilia pelo audit trail depois.
  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_criar_lancamento', 'transacoes_financeiras', v_pai,
    jsonb_build_object('tipo', p_tipo, 'valor', p_valor,
                       'data_vencimento', p_data_vencimento,
                       'conta_id', p_conta_id, 'categoria_id', p_categoria_id,
                       'extras', p_extras,
                       'idempotente', (v_wamid IS NOT NULL AND NOT v_algum_novo)),
    jsonb_build_object('ids', to_jsonb(v_ids)));

  RETURN jsonb_build_object('ok', true, 'id', v_pai,
                            'ids', to_jsonb(v_ids),
                            'warnings', to_jsonb(v_warnings));
END;
$$;

-- ─── fin_criar_transferencia ────────────────────────────────────────────
-- Mesmo racional (guardrail 6b) — fonte anterior confirmada como a mais
-- recente: 20260813150000_fin_criar_transferencia_valida_filial_categorias.sql.

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
  v_wamid text;
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
    IF v_filial IS NOT NULL AND (v_ctx ->> 'canal') = 'web'
       AND NOT public.has_filial_access(v_igreja, v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_origem_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('contas', p_conta_destino_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_saida_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(p_extras ->> 'subcategoria_saida_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(p_extras ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(p_extras ->> 'centro_custo_id','')::uuid, v_igreja);

  SELECT filial_id INTO v_conta_origem_filial FROM public.contas WHERE id = p_conta_origem_id;
  SELECT filial_id INTO v_conta_destino_filial FROM public.contas WHERE id = p_conta_destino_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_origem_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta de origem';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_conta_destino_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta de destino';
  END IF;

  PERFORM public.fin_validar_fk_filial('categorias_financeiras', NULLIF(p_extras ->> 'categoria_saida_id','')::uuid, v_filial);
  PERFORM public.fin_validar_fk_filial('categorias_financeiras', NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid, v_filial);
  PERFORM public.fin_validar_fk_filial('subcategorias_financeiras', NULLIF(p_extras ->> 'subcategoria_saida_id','')::uuid, v_filial);
  PERFORM public.fin_validar_fk_filial('bases_ministeriais', NULLIF(p_extras ->> 'base_ministerial_id','')::uuid, v_filial);
  PERFORM public.fin_validar_fk_filial('centros_custo', NULLIF(p_extras ->> 'centro_custo_id','')::uuid, v_filial);

  -- Trava as duas contas em ordem determinística (por id) ANTES de
  -- qualquer INSERT pago — evita deadlock entre 2 transferências
  -- concorrentes em direções opostas.
  PERFORM 1 FROM public.contas
   WHERE id IN (p_conta_origem_id, p_conta_destino_id)
   ORDER BY id
     FOR NO KEY UPDATE;

  -- Idempotência de ledger (ADR-033 PR2a-2) — ausente = comportamento
  -- 100% idêntico ao anterior a esta migration.
  v_wamid := NULLIF(p_extras ->> 'wamid', '');

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
    igreja_id, filial_id, status, criado_por, sessao_id, wamid
  ) VALUES (
    p_conta_origem_id, p_conta_destino_id, p_valor,
    p_data, p_data,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    v_igreja, v_filial, 'executada',
    COALESCE(NULLIF(p_extras ->> 'criado_por','')::uuid, (v_ctx ->> 'ator_profile_id')::uuid),
    NULLIF(p_extras ->> 'sessao_bot_id','')::uuid,
    v_wamid
  )
  ON CONFLICT (igreja_id, wamid) WHERE (wamid IS NOT NULL)
  DO NOTHING
  RETURNING id INTO v_transf;

  IF v_transf IS NULL AND v_wamid IS NOT NULL THEN
    -- Conflito = já processado (retentativa do mesmo wamid) — idempotência,
    -- não erro: devolve o resultado já criado, SEM duplicar as 2 pernas
    -- de transacoes_financeiras (ambas já existem da 1ª tentativa).
    -- igreja_id no WHERE (achado real de /security-review local): mesmo
    -- racional de fin_criar_lancamento — sem isso, um wamid colidido sob
    -- OUTRO tenant recuperaria silenciosamente o id de outra igreja.
    SELECT id, transacao_saida_id, transacao_entrada_id
      INTO v_transf, v_tx_saida, v_tx_entrada
    FROM public.transferencias_contas
    WHERE igreja_id = v_igreja AND wamid = v_wamid;

    IF v_transf IS NULL THEN
      RAISE EXCEPTION 'FIN_INCONSISTENTE: conflito de idempotência sem row correspondente (igreja_id=%, wamid=%)', v_igreja, v_wamid;
    END IF;

    -- Audita mesmo no replay (achado real de /code-review local — 2
    -- ângulos independentes): sem isso, este early return pula
    -- fin_registrar_auditoria e quebra a invariante "toda RPC de escrita
    -- bem-sucedida é auditada" que fin_criar_lancamento mantém (o loop
    -- dela cai no fim normal mesmo com todos os itens recuperados por
    -- conflito). 'idempotente' no payload distingue replay de criação
    -- nova pra quem olhar o audit log depois.
    PERFORM public.fin_registrar_auditoria(
      v_ctx, 'fin_criar_transferencia', 'transferencias_contas', v_transf,
      jsonb_build_object('conta_origem_id', p_conta_origem_id,
                         'conta_destino_id', p_conta_destino_id,
                         'valor', p_valor, 'data', p_data, 'extras', p_extras,
                         'idempotente', true),
      jsonb_build_object('transacao_saida_id', v_tx_saida,
                         'transacao_entrada_id', v_tx_entrada));

    RETURN jsonb_build_object('ok', true, 'id', v_transf,
                              'transacao_saida_id', v_tx_saida,
                              'transacao_entrada_id', v_tx_entrada,
                              'warnings', '[]'::jsonb);
  END IF;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor,
    data_vencimento, data_pagamento, data_competencia, status,
    forma_pagamento, forma_pagamento_id, conta_id, categoria_id, subcategoria_id,
    base_ministerial_id, centro_custo_id, transferencia_id,
    observacoes, anexo_url, lancado_por, igreja_id, filial_id,
    wamid, wamid_item_key
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
    v_igreja, v_filial,
    v_wamid, CASE WHEN v_wamid IS NOT NULL THEN 'saida' ELSE NULL END
  ) RETURNING id INTO v_tx_saida;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor,
    data_vencimento, data_pagamento, data_competencia, status,
    forma_pagamento, forma_pagamento_id, conta_id, categoria_id,
    base_ministerial_id, centro_custo_id, transferencia_id,
    observacoes, anexo_url, lancado_por, igreja_id, filial_id,
    wamid, wamid_item_key
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
    v_igreja, v_filial,
    v_wamid, CASE WHEN v_wamid IS NOT NULL THEN 'entrada' ELSE NULL END
  ) RETURNING id INTO v_tx_entrada;

  UPDATE public.transferencias_contas
     SET transacao_saida_id = v_tx_saida,
         transacao_entrada_id = v_tx_entrada,
         updated_at = now()
   WHERE id = v_transf;

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
