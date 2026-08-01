-- ============================================================================
-- 3 achados do /code-review (PR #67, rodada com @codex review disparado às
-- 12:21 de 01/08), todos verificados por leitura direta do código atual:
--
-- 1) P1 — fin_conferencia_totais_getnet (20260729140000) validava p_conta_id
--    só com fin_validar_fk_tenant, que checa igreja_id mas NUNCA filial_id
--    (é um validador de FK genérico, usado também pra tabelas sem filial).
--    Sendo SECURITY DEFINER (bypassa RLS), um tesoureiro restrito a uma
--    filial que soubesse o UUID de uma conta de OUTRA filial da mesma
--    igreja conseguia ler os totais agregados (oferta bruto, taxa MDR,
--    deságio, saldo bancário) daquela conta — mesma classe de bug já
--    corrigida em fin_lancar_desagio_antecipacao (20260731150000): falta o
--    has_filial_access contra a filial EFETIVA da conta escolhida.
--
-- 2) P2 — fin_criar_lancamento (20260729130000), resolução de forma_
--    pagamento_id por RÓTULO (sem id explícito, usado pelo bot): buscava só
--    por igreja_id + lower(nome), ignorando filial_id. formas_pagamento
--    aceita uma linha por filial além de uma global (mesmo padrão já
--    documentado em useFormaPagamentoDinheiroId, achado de rodada anterior)
--    — uma igreja com "Dinheiro" cadastrado em duas filiais diferentes podia
--    ter uma transação da filial A resolvida silenciosamente pra forma da
--    filial B (a mais antiga ativa, sem relação com a filial real do
--    lançamento). O backfill (mesma migration, passo 2b) tinha o mesmo
--    problema: DISTINCT ON (igreja_id, lower(nome)) colapsa TODAS as
--    filiais da igreja num candidato só.
--
--    Fix: tanto o resolver da RPC quanto o backfill agora restringem e
--    priorizam por filial — candidato da MESMA filial da transação primeiro,
--    senão um candidato GLOBAL (filial_id NULL); nunca cai pra uma filial
--    diferente da do lançamento (mesma convenção de "filial compartilhada"
--    usada em todo o resto do módulo). O backfill é reescrito como
--    correlated subquery (1 linha por vez, correto por natureza) em vez de
--    JOIN com um DISTINCT ON pré-calculado (que só pode ter 1 candidato por
--    nome pra igreja INTEIRA) — e roda de novo mesmo pra linhas que o
--    backfill anterior (flawed) já tinha preenchido, corrigindo quem ficou
--    com a filial errada.
--
-- 3) P2 — a FK nova forma_pagamento_id (20260729130000, ADD COLUMN ...
--    REFERENCES formas_pagamento(id), sem ON DELETE explícito) herda o
--    default NO ACTION. Toda outra FK pra formas_pagamento no schema usa
--    ON DELETE CASCADE (forma_pagamento_contas) ou SET NULL — aqui CASCADE
--    apagaria a TRANSAÇÃO inteira (errado), mas NO ACTION quebra o fluxo já
--    existente de FormasPagamento.tsx: excluir uma forma referenciada por
--    qualquer transação (ainda que histórica) agora falha com violação de
--    FK, onde antes (coluna não existia) sempre funcionava. Fix: ON DELETE
--    SET NULL — exclui a forma sem apagar a transação; forma_pagamento
--    (texto legado) preserva o nome histórico mesmo depois.
-- ============================================================================

-- ─── 1. fin_conferencia_totais_getnet — valida filial da conta ────────────

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

  -- fin_validar_fk_tenant só garante que a conta é do TENANT certo — é
  -- SECURITY DEFINER, então sem este check um tesoureiro restrito a uma
  -- filial conseguia ler totais agregados de conta de outra filial (achado
  -- do /code-review).
  SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial desta conta';
  END IF;

  SELECT COALESCE(SUM(t.valor), 0), COALESCE(SUM(t.taxas_administrativas), 0)
    INTO v_oferta_bruto, v_taxa_mdr
    FROM public.transacoes_financeiras t
    JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
   WHERE t.igreja_id = v_igreja
     AND t.conta_id = p_conta_id
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.data_vencimento BETWEEN p_data_inicio AND p_data_fim
     AND fp.nome ILIKE '%cart%';

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

-- ─── 2. fin_criar_lancamento — resolução de forma_pagamento por rótulo ────
-- respeita filial (própria filial primeiro, senão global; nunca uma filial
-- diferente da do lançamento) ───────────────────────────────────────────────

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
    -- Restringe a candidatos da MESMA filial do lançamento ou globais
    -- (filial_id NULL), e prioriza a própria filial sobre o global; nunca
    -- resolve pra uma filial DIFERENTE (achado do /code-review: igreja com
    -- "Dinheiro" cadastrado em 2 filiais podia grudar a forma da filial
    -- errada numa transação, mesma classe de bug já resolvida em
    -- useFormaPagamentoDinheiroId pro lado de leitura).
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

-- ─── 3. Backfill corretivo — corrige forma_pagamento_id resolvido sem     ──
-- considerar filial (tanto linhas NULL quanto linhas que o backfill        ──
-- original de 20260729130000 já preencheu com o candidato errado) ─────────
-- Correlated subquery (1 linha por vez) em vez de JOIN com DISTINCT ON
-- pré-calculado: DISTINCT ON (igreja_id, lower(nome)) só pode ter 1
-- candidato por nome pra igreja INTEIRA, então não tem como respeitar
-- filial — precisa resolver por linha, cada uma com sua própria filial_id.

-- Postgres não aceita LATERAL referenciando a própria tabela-alvo do
-- UPDATE ("invalid reference to FROM-clause entry for table t") — resolve
-- o melhor candidato por linha numa CTE primeiro (subquery correlacionada
-- comum, sem essa restrição), depois faz o UPDATE ... FROM contra a CTE.
WITH melhor AS (
  SELECT t.id AS transacao_id,
         (SELECT fp.id
            FROM public.formas_pagamento fp
           WHERE fp.igreja_id = t.igreja_id
             AND lower(fp.nome) = lower(t.forma_pagamento)
             AND (fp.filial_id IS NOT DISTINCT FROM t.filial_id OR fp.filial_id IS NULL)
           ORDER BY (fp.filial_id IS NOT DISTINCT FROM t.filial_id) DESC, fp.ativo DESC, fp.created_at ASC
           LIMIT 1) AS forma_id
    FROM public.transacoes_financeiras t
   WHERE t.forma_pagamento IS NOT NULL
     AND t.forma_pagamento !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
UPDATE public.transacoes_financeiras t
   SET forma_pagamento_id = melhor.forma_id
  FROM melhor
 WHERE melhor.transacao_id = t.id
   AND t.forma_pagamento_id IS DISTINCT FROM melhor.forma_id;

-- ─── 4. FK forma_pagamento_id — ON DELETE SET NULL ─────────────────────────
-- A ADD COLUMN original (20260729130000) não tinha ON DELETE explícito
-- (default NO ACTION) — diferente de toda outra FK pra formas_pagamento no
-- schema (forma_pagamento_contas usa CASCADE). NO ACTION aqui quebra
-- FormasPagamento.tsx: excluir uma forma referenciada por qualquer
-- transação (mesmo histórica) passou a falhar com violação de FK, onde
-- antes (coluna não existia) sempre funcionava. CASCADE seria pior — apagaria
-- a transação inteira. SET NULL: exclui a forma, mantém a transação (com o
-- nome legado ainda em forma_pagamento, texto).
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT c.conname INTO v_constraint
    FROM pg_constraint c
   WHERE c.conrelid = 'public.transacoes_financeiras'::regclass
     AND c.contype = 'f'
     AND c.confrelid = 'public.formas_pagamento'::regclass
     AND c.conkey = ARRAY[(
       SELECT attnum FROM pg_attribute
        WHERE attrelid = 'public.transacoes_financeiras'::regclass
          AND attname = 'forma_pagamento_id'
     )];
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.transacoes_financeiras DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.transacoes_financeiras
  ADD CONSTRAINT transacoes_financeiras_forma_pagamento_id_fkey
  FOREIGN KEY (forma_pagamento_id) REFERENCES public.formas_pagamento(id) ON DELETE SET NULL;
