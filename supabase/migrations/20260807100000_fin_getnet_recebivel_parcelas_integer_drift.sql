-- ============================================================================
-- Hotfix — fecha drift de schema não rastreado em
-- getnet_recebivel_lancamentos.parcelas (2026-08-07).
--
-- getnet_recebivel_lancamentos foi criada em
-- 20260729100000_fin_recebivel_getnet_importacao.sql com `parcelas text`
-- (comentário: 'formato bruto do portal, ex. "1 de 7"'). Em produção real a
-- coluna está como `integer` (confirmado via information_schema.columns:
-- data_type=integer, udt_name=int4) — NENHUMA migration deste repositório
-- jamais alterou esse tipo. É drift não rastreado: produção diverge do que o
-- git assume, e nenhuma migration de replay reproduzia isso (o harness da
-- Fase 7a rodava contra `parcelas text`, por isso não pegou o bug abaixo).
--
-- Efeito do drift: várias RPCs fin_* (Fase 2/7a) fazem
-- `COALESCE(g.parcelas, '1 de 1')` seguido de `regexp_match(...)` assumindo
-- texto. Com a coluna sendo `integer`, `COALESCE(integer_col, '1 de 1')`
-- falha na hora de PLANEJAR a query (erro de tipo, code 22P02) — determinístico,
-- 100% das vezes, independente do conteúdo da linha. Comprovado com EXPLAIN
-- numa tabela `integer` vazia. As 129 linhas reais de produção têm
-- `parcelas` 100% NULL hoje — não há dado real do formato "N de M" para
-- migrar/preservar.
--
-- Esta migration é a ÚNICA forward nova desta PR (as migrations históricas
-- 20260805110000 / 20260806100000 já estão aplicadas em produção — editá-las
-- no git NÃO reescreve o corpo das funções no deploy; `supabase db push` só
-- roda arquivos novos). Por isso o ALTER + os CREATE OR REPLACE das RPCs
-- afetadas vivem AQUI:
--   1) ALTER COLUMN parcelas → integer (formaliza no git o que prod já é;
--      USING cobre partida text OU integer)
--   2) fin_vincular_venda_getnet_oferta — desativa detecção via g.parcelas
--   3) fin_listar_ledger_conciliacao_cartao — para de regex em g.parcelas
--   4) fin_importar_recebivel_getnet — não tenta INSERT do rótulo "N de M"
--      numa coluna integer (cairia em invalidos por linha / 22P02)
-- ============================================================================

ALTER TABLE public.getnet_recebivel_lancamentos
  ALTER COLUMN parcelas TYPE integer
  USING CASE WHEN parcelas::text ~ '^[0-9]+$' THEN parcelas::text::integer ELSE NULL END;

COMMENT ON COLUMN public.getnet_recebivel_lancamentos.parcelas IS
  'Coluna integer (drift de schema fechado em 20260807100000 — produção real já era integer, git assumia text desde a criação da tabela). Hoje sempre NULL nas linhas reais: não guarda mais o rótulo bruto "N de M" do portal (isso exigiria uma 2ª coluna, que não existe). RPCs fin_* não tratam mais este campo como texto "parcela atual de total" — ver fin_listar_ledger_conciliacao_cartao/fin_vincular_venda_getnet_oferta/fin_importar_recebivel_getnet.';

-- ─── 2. fin_vincular_venda_getnet_oferta (corpo atualizado) ─────────────────

CREATE OR REPLACE FUNCTION public.fin_vincular_venda_getnet_oferta(
  p_transacao_id uuid,
  p_recebivel_ids uuid[],
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
  v_trx public.transacoes_financeiras%ROWTYPE;
  v_pai uuid;
  v_pai_novo uuid;
  v_rec record;
  v_ids uuid[];
  v_n int;
  v_taxas numeric(14,2) := 0;
  v_liquido numeric(14,2) := 0;
  v_bruto_nsu numeric(14,2);
  v_data_pag date;
  v_patch jsonb;
  v_res jsonb;
  v_warnings text[] := '{}';
  v_nsu text;
  v_nsu_count int;
  v_total_parcelas int;
  v_max_parcela int;
  v_min_parcela int;
  v_n_distintas int;
  v_parcelado boolean := false;
  v_linha record;
  v_nova_id uuid;
  v_filhas uuid[] := '{}';
  v_desc_base text;
  v_competencia date;
  v_filiais_distintas uuid[] := '{}';
  v_tem_filial_compartilhada boolean := false;
BEGIN
  IF p_transacao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_transacao_id é obrigatório';
  END IF;
  IF p_recebivel_ids IS NULL OR coalesce(array_length(p_recebivel_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_recebivel_ids não pode ser vazio';
  END IF;

  -- Deduplica ids preservando ordem determinística pro lock.
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_ids
    FROM unnest(p_recebivel_ids) AS x;
  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_recebivel_ids não pode ser vazio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Lock oferta + recebíveis em ordem de id (evita deadlock).
  SELECT * INTO v_trx
    FROM public.transacoes_financeiras
   WHERE id = p_transacao_id
   ORDER BY id
   FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % inexistente', p_transacao_id;
  END IF;
  IF v_trx.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_TENANT: lançamento fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_trx.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do lançamento';
  END IF;
  IF v_trx.tipo IS DISTINCT FROM 'entrada' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: Hop 2 só vincula ofertas (tipo=entrada)';
  END IF;
  IF v_trx.status = 'cancelado' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lançamento cancelado';
  END IF;
  IF v_trx.conciliacao_status IS DISTINCT FROM 'nao_conciliado' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lançamento já conciliado (% )', v_trx.conciliacao_status;
  END IF;

  -- Âncora de filial: oferta entra no conjunto (guardrail #13 / §9.86).
  IF v_trx.filial_id IS NULL THEN
    v_tem_filial_compartilhada := true;
  ELSE
    v_filiais_distintas := ARRAY[v_trx.filial_id];
  END IF;

  -- Trava recebíveis.
  PERFORM 1
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids)
   ORDER BY g.id
   FOR NO KEY UPDATE;

  SELECT count(*) INTO v_n
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids);
  IF v_n IS DISTINCT FROM array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: um ou mais recebíveis inexistentes';
  END IF;

  -- Valida cada recebível (tenant / filial / ainda livre / venda real).
  FOR v_rec IN
    SELECT g.*
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids)
     ORDER BY g.id
  LOOP
    IF v_rec.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: recebível % fora do tenant', v_rec.id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_rec.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do recebível %', v_rec.id;
    END IF;
    IF v_rec.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_rec.filial_id = ANY (v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_rec.filial_id;
    END IF;
    IF v_rec.transacao_financeira_id IS NOT NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: recebível % já vinculado a %',
        v_rec.id, v_rec.transacao_financeira_id;
    END IF;
    IF v_rec.nsu IS NULL OR v_rec.nsu = '' OR v_rec.valor_venda IS NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: recebível % não é linha de venda (nsu/valor_venda)',
        v_rec.id;
    END IF;
  END LOOP;

  -- Filial mista: rejeita ≥2 filiais concretas sem âncora compartilhada
  -- (filial_id IS NULL). Mesma regra de fin_confirmar_conciliacao (§9.86).
  IF coalesce(array_length(v_filiais_distintas, 1), 0) > 1
     AND NOT v_tem_filial_compartilhada THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: oferta e recebíveis de filiais diferentes não podem ser vinculados juntos';
  END IF;

  -- Detecção de parcelamento via g.parcelas DESATIVADA (hotfix 2026-08-07).
  -- g.parcelas virou `integer` (drift de schema fechado em
  -- 20260807100000_fin_getnet_recebivel_parcelas_integer_drift.sql) —
  -- produção nunca teve de fato o rótulo texto "k de N" que este bloco
  -- assumia; a coluna é 100% NULL nas 129 linhas reais hoje. Um integer
  -- isolado NÃO permite reconstruir "parcela atual DE total" sem uma 2ª
  -- coluna que não existe — tentar via regexp_match(COALESCE(g.parcelas,
  -- '1 de 1'), ...) falha no PLANEJAMENTO da query (COALESCE(integer,
  -- text), erro de tipo 22P02), sempre, independente de dado. Ou seja,
  -- Hop 2 nunca completou com sucesso em produção desde que essa coluna é
  -- integer (todo NSU único cai em v_nsu_count = 1, que executava o bloco
  -- que falhava).
  --
  -- Fix: v_parcelado fica sempre false — segue o caminho à vista (mais
  -- simples, já existia, sempre funcionou). Não é regressão: é o
  -- comportamento que já deveria estar acontecendo (parcelamento via
  -- g.parcelas nunca teve dado real pra detectar). A estrutura da Fase 2b
  -- abaixo (`IF v_parcelado THEN ...`) fica preservada, mas inerte —
  -- inalcançável enquanto v_parcelado nunca vira true. Se um dia
  -- g.parcelas (integer) passar a carregar um dado confiável (não "k de
  -- N"), a detecção precisa ser reescrita do zero para o novo formato —
  -- não reative este bloco como estava.
  SELECT count(DISTINCT g.nsu) INTO v_nsu_count
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids);

  IF v_nsu_count = 1 THEN
    SELECT g.nsu INTO v_nsu
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids)
     LIMIT 1;
  END IF;

  v_parcelado := false;
  v_total_parcelas := 1;

  IF v_parcelado THEN
    -- 2b: conjunto completo 1..N obrigatório.
    IF v_n_distintas IS DISTINCT FROM v_total_parcelas
       OR v_min_parcela IS DISTINCT FROM 1
       OR v_max_parcela IS DISTINCT FROM v_total_parcelas
       OR array_length(v_ids, 1) IS DISTINCT FROM v_total_parcelas THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: parcelas incompletas do NSU % (recebidos %, esperado 1..%)',
        v_nsu, array_length(v_ids, 1), v_total_parcelas;
    END IF;

    -- Lock de grupo (raiz = própria oferta, ainda unico).
    v_pai := p_transacao_id;
    PERFORM 1
      FROM public.transacoes_financeiras t
     WHERE t.id = v_pai OR t.lancamento_pai_id = v_pai
     ORDER BY t.id
     FOR NO KEY UPDATE;

    -- Re-resolve (padrão §9.72–§9.77): se já tinha pai, sobe.
    SELECT COALESCE(t.lancamento_pai_id, t.id) INTO v_pai_novo
      FROM public.transacoes_financeiras t WHERE t.id = p_transacao_id;
    IF v_pai_novo IS DISTINCT FROM v_pai THEN
      v_pai := v_pai_novo;
      PERFORM 1
        FROM public.transacoes_financeiras t
       WHERE t.id = v_pai OR t.lancamento_pai_id = v_pai
       ORDER BY t.id
       FOR NO KEY UPDATE;
    END IF;

    IF v_pai IS DISTINCT FROM p_transacao_id THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: lançamento já pertence a um grupo parcelado; Hop 2 espera a raiz';
    END IF;

    v_desc_base := regexp_replace(v_trx.descricao, '\s*\(\d+/\d+\)\s*$', '');
    v_competencia := COALESCE(v_trx.data_competencia, v_trx.data_vencimento);

    -- Parcela 1 = linha "1 de N": atualiza a oferta original (preserva id/sessao).
    SELECT g.*,
           (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int AS num_parc
      INTO v_linha
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids)
       AND (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int = 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: falta a parcela 1 de % do NSU %', v_total_parcelas, v_nsu;
    END IF;

    v_taxas := abs(COALESCE(v_linha.descontos, 0));
    v_liquido := COALESCE(v_linha.valor_liquido_parcela,
                          COALESCE(v_linha.valor_parcela, v_linha.valor_venda) - v_taxas);
    v_data_pag := v_linha.data_vencimento;

    v_patch := jsonb_build_object(
      'tipo_lancamento', 'parcelado',
      'numero_parcela', 1,
      'total_parcelas', v_total_parcelas,
      'valor', COALESCE(v_linha.valor_parcela, v_linha.valor_venda),
      'taxas_administrativas', v_taxas,
      'valor_liquido', v_liquido,
      'data_vencimento', v_linha.data_vencimento,
      'data_competencia', v_competencia,
      'data_pagamento', v_data_pag,
      'status', 'pago',
      'descricao', v_desc_base || format(' (1/%s)', v_total_parcelas)
    );

    v_res := public.fin_atualizar_lancamento(p_transacao_id, v_patch, v_ctx);
    IF COALESCE((v_res ->> 'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: falha ao atualizar parcela 1: %', v_res;
    END IF;

    UPDATE public.getnet_recebivel_lancamentos
       SET transacao_financeira_id = p_transacao_id
     WHERE id = v_linha.id;

    -- Irmãs 2..N
    FOR v_linha IN
      SELECT g.*,
             (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int AS num_parc
        FROM public.getnet_recebivel_lancamentos g
       WHERE g.id = ANY (v_ids)
         AND (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int > 1
       ORDER BY (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int, g.id
    LOOP
      v_taxas := abs(COALESCE(v_linha.descontos, 0));
      -- Mesmo fallback da parcela 1: valor_parcela → valor_venda (nunca 0).
      v_liquido := COALESCE(v_linha.valor_liquido_parcela,
                            COALESCE(v_linha.valor_parcela, v_linha.valor_venda) - v_taxas);

      INSERT INTO public.transacoes_financeiras (
        tipo, tipo_lancamento, descricao, valor, valor_liquido,
        data_vencimento, data_competencia, data_pagamento,
        conta_id, categoria_id, subcategoria_id, centro_custo_id,
        base_ministerial_id, fornecedor_id, forma_pagamento, forma_pagamento_id,
        total_parcelas, numero_parcela,
        observacoes, lancado_por, status,
        juros, multas, desconto, taxas_administrativas,
        pessoa_id, sessao_id,
        origem_registro, lancamento_pai_id, igreja_id, filial_id,
        conciliacao_status, conferido_manual
      ) VALUES (
        v_trx.tipo, 'parcelado',
        v_desc_base || format(' (%s/%s)', v_linha.num_parc, v_total_parcelas),
        COALESCE(v_linha.valor_parcela, v_linha.valor_venda),
        v_liquido,
        v_linha.data_vencimento,
        v_competencia,
        NULL,
        v_trx.conta_id, v_trx.categoria_id, v_trx.subcategoria_id, v_trx.centro_custo_id,
        v_trx.base_ministerial_id, v_trx.fornecedor_id, v_trx.forma_pagamento, v_trx.forma_pagamento_id,
        v_total_parcelas, v_linha.num_parc,
        v_trx.observacoes, v_trx.lancado_por, 'pendente',
        0, 0, 0, v_taxas,
        v_trx.pessoa_id, v_trx.sessao_id,
        COALESCE(v_trx.origem_registro, 'manual'), p_transacao_id, v_igreja, v_trx.filial_id,
        'conciliado_manual', true
      )
      RETURNING id INTO v_nova_id;

      v_filhas := v_filhas || v_nova_id;

      UPDATE public.getnet_recebivel_lancamentos
         SET transacao_financeira_id = v_nova_id
       WHERE id = v_linha.id;
    END LOOP;

    UPDATE public.transacoes_financeiras
       SET conciliacao_status = 'conciliado_manual',
           conferido_manual = true
     WHERE id = p_transacao_id;

    v_warnings := v_warnings || format(
      'Hop 2 parcelado: oferta %s virou 1/%s; criadas %s irmãs',
      p_transacao_id, v_total_parcelas, coalesce(array_length(v_filhas, 1), 0));

  ELSE
    -- ─── Caminho à vista (1 de 1 / vários NSUs à vista) ───────────────────
    SELECT COALESCE(SUM(abs(COALESCE(g.descontos, 0))), 0),
           COALESCE(SUM(COALESCE(g.valor_liquido_parcela,
                                 COALESCE(g.valor_parcela, g.valor_venda)
                                 - abs(COALESCE(g.descontos, 0)))), 0),
           MAX(g.data_vencimento)
      INTO v_taxas, v_liquido, v_data_pag
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids);

    -- Confere bruto (1× por NSU) ≈ valor da oferta (±0,01).
    SELECT COALESCE(SUM(v), 0) INTO v_bruto_nsu
      FROM (
        SELECT MAX(g.valor_venda) AS v
          FROM public.getnet_recebivel_lancamentos g
         WHERE g.id = ANY (v_ids)
         GROUP BY g.nsu
      ) s;

    IF abs(v_bruto_nsu - v_trx.valor) > 0.01 THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: bruto Getnet (%) diverge do valor da oferta (%)',
        v_bruto_nsu, v_trx.valor;
    END IF;

    UPDATE public.getnet_recebivel_lancamentos
       SET transacao_financeira_id = p_transacao_id
     WHERE id = ANY (v_ids);

    v_patch := jsonb_build_object(
      'taxas_administrativas', v_taxas,
      'valor_liquido', v_liquido,
      'data_pagamento', v_data_pag,
      'status', 'pago'
    );

    v_res := public.fin_atualizar_lancamento(p_transacao_id, v_patch, v_ctx);
    IF COALESCE((v_res ->> 'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: falha ao atualizar oferta: %', v_res;
    END IF;

    UPDATE public.transacoes_financeiras
       SET conciliacao_status = 'conciliado_manual',
           conferido_manual = true
     WHERE id = p_transacao_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_vincular_venda_getnet_oferta', 'transacoes_financeiras', p_transacao_id,
    jsonb_build_object(
      'recebivel_ids', to_jsonb(v_ids),
      'parcelado', v_parcelado,
      'nsu', v_nsu,
      'total_parcelas', v_total_parcelas,
      'tipo_match', 'oferta_venda_getnet'
    ),
    jsonb_build_object(
      'ok', true,
      'filhas', to_jsonb(v_filhas),
      'taxas', v_taxas,
      'liquido', v_liquido,
      'warnings', to_jsonb(v_warnings)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_transacao_id,
    'recebivel_ids', to_jsonb(v_ids),
    'parcelado', v_parcelado,
    'filhas', to_jsonb(v_filhas),
    'taxas_administrativas', v_taxas,
    'valor_liquido', v_liquido,
    'warnings', to_jsonb(v_warnings)
  );
END;
$$;

COMMENT ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb) IS
  'Fase 2 Conciliação Cartão Getnet (Hop 2): vincula recebíveis à oferta, atualiza taxa/líquido/pagamento via fin_atualizar_lancamento, marca conciliado_manual. Fase 2b: NSU com N>1 parcelas (conjunto completo) converte a oferta em parcela 1/N e cria irmãs 2..N. has_filial_access na oferta e em cada recebível; filial mista só com âncora compartilhada (guardrail #13).';

GRANT EXECUTE ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb)
  FROM anon;

-- ─── 3. fin_listar_ledger_conciliacao_cartao (corpo atualizado) ────────────

CREATE OR REPLACE FUNCTION public.fin_listar_ledger_conciliacao_cartao(
  p_integracao_id uuid,
  p_conta_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_contexto jsonb DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL
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
  v_integracao record;
  v_conta record;
  v_scope uuid;
  v_resultado jsonb;
BEGIN
  IF p_integracao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_integracao_id é obrigatório';
  END IF;
  IF p_conta_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_conta_id é obrigatório';
  END IF;
  IF p_periodo_inicio IS NULL OR p_periodo_fim IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_periodo_inicio e p_periodo_fim são obrigatórios';
  END IF;
  IF p_periodo_fim < p_periodo_inicio THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_periodo_fim anterior a p_periodo_inicio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT i.id, i.igreja_id, i.filial_id, i.provedor
    INTO v_integracao
    FROM public.integracoes_financeiras i
   WHERE i.id = p_integracao_id;

  IF v_integracao.id IS NULL OR v_integracao.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: integração inexistente ou fora do tenant';
  END IF;
  IF v_integracao.provedor IS DISTINCT FROM 'getnet' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: integração % não é do provedor getnet', p_integracao_id;
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_integracao.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da integração';
  END IF;

  SELECT c.id, c.igreja_id, c.filial_id
    INTO v_conta
    FROM public.contas c
   WHERE c.id = p_conta_id;

  IF v_conta.id IS NULL OR v_conta.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: conta inexistente ou fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_conta.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta';
  END IF;

  IF p_filial_id IS NOT NULL THEN
    IF NOT public.has_filial_access(v_igreja, p_filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial solicitada';
    END IF;
    v_scope := p_filial_id;
  ELSE
    v_scope := NULL;
  END IF;

  WITH
  -- ─── Raízes de grupo (não-dividido ou parcela 1/N pós Fase 2b) ───────────
  raizes AS (
    SELECT
      t.id,
      t.descricao AS trx_descricao,
      t.data_vencimento,
      t.filial_id,
      t.valor,
      t.numero_parcela,
      t.total_parcelas,
      COALESCE(fp.nome, t.forma_pagamento) AS forma_desc
    FROM public.transacoes_financeiras t
    LEFT JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
   WHERE t.igreja_id = v_igreja
     AND t.conta_id = p_conta_id
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.lancamento_pai_id IS NULL
     AND t.data_vencimento BETWEEN p_periodo_inicio AND p_periodo_fim
     AND COALESCE(fp.nome, t.forma_pagamento, '') ILIKE '%cart%'
     AND public.has_filial_access(v_igreja, t.filial_id)
     AND (v_scope IS NULL OR t.filial_id IS NULL OR t.filial_id = v_scope)
  ),
  -- ─── Todo membro do grupo (raiz + filhas), 1 linha por lançamento ────────
  membros AS (
    SELECT r.id AS trans_id, r.id AS grupo_id, r.numero_parcela, r.total_parcelas, r.valor
      FROM raizes r
    UNION ALL
    SELECT f.id, f.lancamento_pai_id, f.numero_parcela, f.total_parcelas, f.valor
      FROM public.transacoes_financeiras f
     WHERE f.lancamento_pai_id IN (SELECT id FROM raizes)
       AND f.igreja_id = v_igreja
       AND f.status <> 'cancelado'
  ),
  grupo_agg AS (
    SELECT
      grupo_id,
      SUM(valor) AS valor_bruto,
      COUNT(*) AS n_membros,
      COUNT(*) FILTER (WHERE trans_id <> grupo_id) AS n_filhas
    FROM membros
    GROUP BY grupo_id
  ),
  -- ─── Recebíveis Getnet já casados (Hop 2 feito) com cada membro ──────────
  recebiveis_grupo AS (
    SELECT
      m.grupo_id,
      g.id AS recebivel_id,
      g.nsu,
      COALESCE(
        g.valor_liquido_parcela,
        g.valor_liquido,
        COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
      ) AS valor_liquido,
      g.data_vencimento AS data_vencimento_real,
      g.extrato_bancario_id,
      g.contrato_registradora,
      COALESCE(m.numero_parcela, 1) AS numero_parcela,
      COALESCE(m.total_parcelas, 1) AS total_parcelas
    FROM membros m
    JOIN public.getnet_recebivel_lancamentos g
      ON g.transacao_financeira_id = m.trans_id
     AND g.igreja_id = v_igreja
     AND g.integracao_id = p_integracao_id
     AND public.has_filial_access(v_igreja, g.filial_id)
  ),
  recebiveis_status AS (
    SELECT
      rg.*,
      CASE
        WHEN rg.extrato_bancario_id IS NOT NULL THEN 'fechado'
        WHEN rg.contrato_registradora IS NOT NULL
         AND EXISTS (
               SELECT 1 FROM public.getnet_antecipacao_lotes l
                WHERE l.igreja_id = v_igreja
                  AND l.integracao_id = p_integracao_id
                  AND l.contrato_registradora = rg.contrato_registradora
                  AND l.status IN ('vinculado', 'lancamento_criado')
                  AND public.has_filial_access(v_igreja, l.filial_id)
             ) THEN 'antecipada'
        ELSE 'aguardando'
      END AS hop1_status,
      (
        SELECT l.id FROM public.getnet_antecipacao_lotes l
         WHERE l.igreja_id = v_igreja
           AND l.integracao_id = p_integracao_id
           AND l.contrato_registradora = rg.contrato_registradora
           AND public.has_filial_access(v_igreja, l.filial_id)
      ) AS lote_id
    FROM recebiveis_grupo rg
  ),
  grupo_stats AS (
    SELECT
      grupo_id,
      COUNT(*) AS n_recebiveis,
      COUNT(*) FILTER (WHERE hop1_status IN ('fechado', 'antecipada')) AS n_batidas
    FROM recebiveis_status
    GROUP BY grupo_id
  ),
  -- ─── Divergência: soma completa do EC por extrato (Hop 1 agrupa por dia,
  -- não por lançamento — um crédito pode cobrir parcelas de mais de uma
  -- oferta). Gate = HFA no extrato (eb). Soma g2 NÃO filtra HFA: com âncora
  -- compartilhada (#13) a conta vs eb.valor tem que ser completa — HFA em
  -- g2 gerava divergencia falsa (Bugbot review #83). Escopo integracao_id
  -- no g2 pela mesma razão do resto do arquivo.
  divergencia_grupo AS (
    SELECT DISTINCT rs.grupo_id
    FROM recebiveis_status rs
    JOIN public.extratos_bancarios eb
      ON eb.id = rs.extrato_bancario_id
     AND public.has_filial_access(v_igreja, eb.filial_id)
   WHERE rs.extrato_bancario_id IS NOT NULL
     AND abs(
           (
             SELECT COALESCE(SUM(
                      COALESCE(
                        g2.valor_liquido_parcela,
                        g2.valor_liquido,
                        COALESCE(g2.valor_parcela, g2.valor_venda) - abs(COALESCE(g2.descontos, 0))
                      )
                    ), 0)
               FROM public.getnet_recebivel_lancamentos g2
              WHERE g2.extrato_bancario_id = rs.extrato_bancario_id
                AND g2.igreja_id = v_igreja
                AND g2.integracao_id = p_integracao_id
           ) - eb.valor
         ) > 0.01
  ),
  parcelas_agg AS (
    SELECT
      grupo_id,
      jsonb_agg(
        jsonb_build_object(
          'numero_parcela', numero_parcela,
          'total_parcelas', total_parcelas,
          'nsu', nsu,
          'valor_liquido', valor_liquido,
          'data_vencimento_real', data_vencimento_real,
          'hop1_status', hop1_status,
          'extrato_bancario_id', extrato_bancario_id,
          'lote_id', lote_id
        )
        ORDER BY numero_parcela, recebivel_id
      ) AS parcelas
    FROM recebiveis_status
    GROUP BY grupo_id
  ),
  -- ─── Sugestão Hop 2: 1 chamada pro período inteiro, join por transacao_id ─
  sugestoes AS (
    SELECT DISTINCT ON (c.transacao_id)
      c.transacao_id,
      c.recebivel_ids,
      c.score,
      c.features
    FROM public.fin_gerar_candidatos_oferta_venda_getnet(
           p_integracao_id, p_periodo_inicio, p_periodo_fim, v_ctx, v_scope
         ) c
   WHERE c.transacao_id IS NOT NULL
   ORDER BY c.transacao_id, c.score DESC
  ),
  lancamentos_montados AS (
    SELECT
      r.id AS grupo_id,
      r.forma_desc AS descricao,
      r.data_vencimento,
      r.filial_id,
      ga.valor_bruto,
      (COALESCE(ga.n_filhas, 0) > 0) AS parcelado,
      (COALESCE(ga.n_filhas, 0) + 1) AS total_parcelas,
      CASE
        WHEN COALESCE(gs.n_recebiveis, 0) = 0 THEN 'sem_hop2'
        WHEN r.id IN (SELECT grupo_id FROM divergencia_grupo) THEN 'divergencia'
        -- Exige cobrir todos os membros do grupo (raiz+filhas), não só os
        -- recebíveis já linkados — Hop 2 incompleto não vira "fechado".
        WHEN gs.n_batidas = gs.n_recebiveis
         AND gs.n_recebiveis >= ga.n_membros THEN 'fechado'
        ELSE 'aguardando_banco'
      END AS status,
      COALESCE(pa.parcelas, '[]'::jsonb) AS parcelas,
      CASE
        WHEN COALESCE(gs.n_recebiveis, 0) = 0 AND s.transacao_id IS NOT NULL THEN
          jsonb_build_object(
            'recebivel_ids', to_jsonb(s.recebivel_ids),
            'score', s.score,
            'features', s.features
          )
        ELSE NULL
      END AS sugestao
    FROM raizes r
    JOIN grupo_agg ga ON ga.grupo_id = r.id
    LEFT JOIN grupo_stats gs ON gs.grupo_id = r.id
    LEFT JOIN parcelas_agg pa ON pa.grupo_id = r.id
    LEFT JOIN sugestoes s ON s.transacao_id = r.id
  ),
  lancamentos_final AS (
    SELECT jsonb_agg(
             jsonb_build_object(
               'grupo_id', grupo_id,
               'descricao', descricao,
               'data_vencimento', data_vencimento,
               'filial_id', filial_id,
               'valor_bruto', valor_bruto,
               'parcelado', parcelado,
               'total_parcelas', total_parcelas,
               'status', status,
               'parcelas', parcelas,
               'sugestao', sugestao
             )
             ORDER BY data_vencimento, grupo_id
           ) AS arr,
           COUNT(*) FILTER (WHERE status = 'fechado') AS n_fechados,
           COUNT(*) FILTER (WHERE status = 'aguardando_banco') AS n_aguardando,
           COUNT(*) FILTER (WHERE status = 'sem_hop2') AS n_sem_hop2,
           COUNT(*) FILTER (WHERE status = 'divergencia') AS n_divergencia
      FROM lancamentos_montados
  ),
  -- ─── Lotes de antecipação do período (ou já tocados por vendas do período) ─
  lotes_candidatos AS (
    SELECT l.*
      FROM public.getnet_antecipacao_lotes l
     WHERE l.igreja_id = v_igreja
       AND l.integracao_id = p_integracao_id
       AND public.has_filial_access(v_igreja, l.filial_id)
       AND (v_scope IS NULL OR l.filial_id IS NULL OR l.filial_id = v_scope)
       AND (
             (l.data_contratacao_contrato BETWEEN p_periodo_inicio AND p_periodo_fim)
             OR EXISTS (
                  SELECT 1 FROM public.getnet_recebivel_lancamentos g
                   WHERE g.igreja_id = v_igreja
                     AND g.integracao_id = p_integracao_id
                     AND g.contrato_registradora = l.contrato_registradora
                     AND g.data_venda BETWEEN p_periodo_inicio AND p_periodo_fim
                )
           )
       -- Conta: lote já vinculado só entra se o extrato é desta conta; lote
       -- ainda pendente_vinculo (sem extrato) não tem conta própria — segue
       -- aparecendo pra permitir a ação "Vincular extrato" (mesmo
       -- comportamento sem escopo de conta que LotesAntecipacaoTab já tem
       -- hoje pra esse caso).
       AND (
             l.extrato_bancario_id IS NULL
             OR EXISTS (
                  SELECT 1 FROM public.extratos_bancarios eb
                   WHERE eb.id = l.extrato_bancario_id
                     AND eb.conta_id = p_conta_id
                )
           )
  ),
  vendas_origem_agg AS (
    SELECT
      lc.id AS lote_id,
      jsonb_agg(
        jsonb_build_object(
          'nsu', g.nsu,
          'valor_parcela_liquido', COALESCE(
            g.valor_liquido_parcela,
            g.valor_liquido,
            COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
          ),
          -- g.parcelas é `integer` (drift de schema fechado em
          -- 20260807100000; produção nunca teve o rótulo texto "N de M" —
          -- coluna 100% NULL nas linhas reais). Um integer isolado não
          -- permite reconstruir "parcela atual DE total" sem uma 2ª coluna
          -- que não existe — não tenta mais extrair via regex; cai direto
          -- no fallback 1, que é o comportamento real hoje (ot.numero_
          -- parcela/ot.total_parcelas de transacoes_financeiras seguem
          -- confiáveis quando a venda já tem oferta vinculada).
          'numero_parcela', COALESCE(ot.numero_parcela, 1),
          'total_parcelas', COALESCE(ot.total_parcelas, 1),
          -- Sem HFA na oferta: nullar metadados (não vazar descrição/data
          -- de filial inacessível via recebível global).
          'oferta_lancamento_id', CASE
            WHEN ot.id IS NULL THEN NULL
            WHEN public.has_filial_access(v_igreja, ot.filial_id) THEN ot.id
            ELSE NULL
          END,
          'oferta_descricao', CASE
            WHEN ot.id IS NOT NULL AND public.has_filial_access(v_igreja, ot.filial_id)
              THEN ot.descricao
            ELSE NULL
          END,
          'oferta_data_vencimento', CASE
            WHEN ot.id IS NOT NULL AND public.has_filial_access(v_igreja, ot.filial_id)
              THEN ot.data_vencimento
            ELSE NULL
          END
        )
        ORDER BY g.data_venda, g.id
      ) AS vendas_origem
    FROM lotes_candidatos lc
    JOIN public.getnet_recebivel_lancamentos g
      ON g.igreja_id = v_igreja
     AND g.integracao_id = p_integracao_id
     AND g.contrato_registradora = lc.contrato_registradora
     AND public.has_filial_access(v_igreja, g.filial_id)
    LEFT JOIN public.transacoes_financeiras ot ON ot.id = g.transacao_financeira_id
    GROUP BY lc.id
  ),
  lotes_final AS (
    SELECT jsonb_agg(
             jsonb_build_object(
               'lote_id', lc.id,
               'contrato_registradora', lc.contrato_registradora,
               'status', lc.status,
               'filial_id', lc.filial_id,
               'valor_contrato', lc.valor_atual_contrato,
               'desagio', CASE WHEN eb.id IS NOT NULL THEN lc.valor_atual_contrato - eb.valor ELSE NULL END,
               'credito_banco', eb.valor,
               'data_liquidacao', eb.data_transacao,
               'vendas_origem', COALESCE(voa.vendas_origem, '[]'::jsonb)
             )
             ORDER BY lc.data_contratacao_contrato NULLS LAST, lc.id
           ) AS arr
      FROM lotes_candidatos lc
      -- HFA no extrato: lote global + extrato de outra filial não vaza
      -- credito_banco/data_liquidacao (review #83 / §9.78).
      LEFT JOIN public.extratos_bancarios eb
        ON eb.id = lc.extrato_bancario_id
       AND public.has_filial_access(v_igreja, eb.filial_id)
      LEFT JOIN vendas_origem_agg voa ON voa.lote_id = lc.id
  )
  SELECT jsonb_build_object(
           'resumo', jsonb_build_object(
             'fechados', COALESCE(lf.n_fechados, 0),
             'aguardando_banco', COALESCE(lf.n_aguardando, 0),
             'sem_hop2', COALESCE(lf.n_sem_hop2, 0),
             'divergencia', COALESCE(lf.n_divergencia, 0)
           ),
           'lancamentos', COALESCE(lf.arr, '[]'::jsonb),
           'lotes', COALESCE(lotf.arr, '[]'::jsonb)
         )
    INTO v_resultado
    FROM lancamentos_final lf
    FULL OUTER JOIN lotes_final lotf ON true;

  RETURN COALESCE(
    v_resultado,
    jsonb_build_object(
      'resumo', jsonb_build_object('fechados', 0, 'aguardando_banco', 0, 'sem_hop2', 0, 'divergencia', 0),
      'lancamentos', '[]'::jsonb,
      'lotes', '[]'::jsonb
    )
  );
END;
$$;

COMMENT ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid) IS
  'Fase 7a Conciliação Cartão Getnet (só leitura): monta o ledger unificado Oferta→Venda→Banco + lotes de antecipação por período. Status de linha (sem_hop2/aguardando_banco/fechado/divergencia) deliberadamente distinto do enum getnet_antecipacao_lotes.status. Sugestão Hop 2 via 1 chamada de fin_gerar_candidatos_oferta_venda_getnet por período (join único por transacao_id, DISTINCT ON score DESC). Divergência = Σ valor_liquido do EC por extrato vs extratos_bancarios.valor, tol. R$0,01; gate has_filial_access só no extrato (eb) — soma g2 completa (igreja+integracao, sem HFA por recebível) pra não gerar divergencia falsa com âncora compartilhada #13 (review #83). lancamentos escopados por transacoes_financeiras.conta_id = p_conta_id; recebíveis/lotes/vendas_origem por integracao_id = p_integracao_id; lotes vinculados só entram se o extrato é da mesma conta, lotes pendente_vinculo aparecem sem escopo de conta. Extrato do lote e metadados de oferta em vendas_origem exigem has_filial_access. fechado exige n_batidas = n_recebiveis >= n_membros.';

GRANT EXECUTE ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid)
  FROM anon;

-- ─── 4. fin_importar_recebivel_getnet (corpo atualizado) ───────────────────

CREATE OR REPLACE FUNCTION public.fin_importar_recebivel_getnet(
  p_integracao_id uuid,
  p_linhas jsonb,
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
  v_integracao record;
  v_pode_todas boolean;
  v_job_id uuid;
  v_total int;
  v_inseridos int := 0;
  v_duplicados int := 0;
  v_subtotal_ignoradas int := 0;
  v_invalidos int := 0;
  v_warnings text[] := '{}';
  v_ocorrencias jsonb := '{}'::jsonb;
  v_item jsonb;
  v_tipo_lanc text;
  v_data_vencimento date;
  v_bandeira text;
  v_lancamento text;
  v_nsu text;
  v_valor_liquido numeric;
  v_data_venda date;
  v_chave text;
  v_ocorrencia int;
  v_dedupe_key text;
  v_contrato text;
  v_valor_atual_contrato numeric;
  v_novo boolean;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  v_pode_todas := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
       AND (ur.igreja_id = v_igreja OR ur.igreja_id IS NULL)
  );

  -- Integração no tenant + provedor getnet (SECURITY DEFINER bypassa RLS).
  SELECT id, igreja_id, filial_id, provedor INTO v_integracao
    FROM public.integracoes_financeiras WHERE id = p_integracao_id;
  IF v_integracao.id IS NULL OR v_integracao.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: integração inexistente ou fora do tenant';
  END IF;
  IF v_integracao.provedor <> 'getnet' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: integração % não é do provedor getnet', p_integracao_id;
  END IF;
  IF NOT (
       v_pode_todas
       OR v_integracao.filial_id IS NULL
       OR v_integracao.filial_id IS NOT DISTINCT FROM v_filial
       OR (auth.uid() IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.user_filial_access ufa
              WHERE ufa.user_id = auth.uid()
                AND ufa.filial_id = v_integracao.filial_id
                AND ufa.can_view = true))
     ) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da integração';
  END IF;

  -- Auditoria/job refletem a filial da INTEGRAÇÃO, não o default do contexto.
  v_ctx := v_ctx || jsonb_build_object('filial_id', v_integracao.filial_id);

  v_total := COALESCE(jsonb_array_length(p_linhas), 0);
  IF v_total = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: nenhuma linha para importar';
  END IF;

  INSERT INTO public.fin_extrato_ingestao_jobs
    (igreja_id, filial_id, conta_id, origem, total_itens, ator_profile_id, canal)
  VALUES
    (v_igreja, v_integracao.filial_id, NULL, 'getnet_recebivel_portal', v_total,
     NULLIF(v_ctx ->> 'ator_profile_id','')::uuid, v_ctx ->> 'canal')
  RETURNING id INTO v_job_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_linhas)
  LOOP
    -- Isola cada linha: uma linha malformada não derruba o lote inteiro.
    BEGIN
      v_tipo_lanc := COALESCE(v_item ->> 'tipo_lancamento', '');
      IF lower(v_tipo_lanc) = 'subtotal' THEN
        v_subtotal_ignoradas := v_subtotal_ignoradas + 1;
        CONTINUE;
      END IF;

      v_data_vencimento := NULLIF(v_item ->> 'data_vencimento', '')::date;
      v_bandeira := NULLIF(v_item ->> 'bandeira_modalidade', '');
      v_lancamento := NULLIF(v_item ->> 'lancamento', '');
      v_nsu := NULLIF(v_item ->> 'nsu', '');
      v_valor_liquido := NULLIF(v_item ->> 'valor_liquido', '')::numeric;
      v_data_venda := NULLIF(v_item ->> 'data_venda', '')::date;
      -- "0" é o sentinel do portal pra "sem contrato" (visto em Pagamento
      -- Realizado/Valor Liquidado (R$)) — não é um Contrato Registradora real.
      v_contrato := NULLIF(NULLIF(v_item ->> 'contrato_registradora', ''), '0');
      v_valor_atual_contrato := NULLIF(v_item ->> 'valor_atual_contrato', '')::numeric;

      -- Chave natural + contador de ocorrência dentro do lote (mesmo padrão
      -- do dedupe Santander/PR#56): linhas "Saldo Anterior" genuinamente
      -- duplicadas no CSV real não podem ser descartadas como falso positivo.
      v_chave := COALESCE(v_data_vencimento::text, '') || '|' || COALESCE(v_bandeira, '') || '|' ||
                 v_tipo_lanc || '|' || COALESCE(v_lancamento, '') || '|' ||
                 COALESCE(v_nsu, '') || '|' || COALESCE(v_valor_liquido::text, '') || '|' ||
                 COALESCE(v_data_venda::text, '');
      v_ocorrencia := COALESCE((v_ocorrencias ->> v_chave)::int, 0);
      v_ocorrencias := v_ocorrencias || jsonb_build_object(v_chave, v_ocorrencia + 1);
      v_dedupe_key := md5(v_chave || '#' || v_ocorrencia);

      INSERT INTO public.getnet_recebivel_lancamentos (
        integracao_id, igreja_id, filial_id, import_job_id,
        data_vencimento, bandeira_modalidade, tipo_lancamento, lancamento,
        valor_liquido, valor_liquidado,
        numero_cartao, autorizacao, nsu, terminal_logico,
        data_venda, hora_venda, valor_venda, parcelas, valor_parcela,
        descontos, valor_liquido_parcela,
        data_contratacao_contrato, instituicao_negociadora, contrato_registradora,
        valor_atual_contrato, valor_liquidado_contrato, valor_a_liquidar_contrato,
        dedupe_key
      ) VALUES (
        p_integracao_id, v_igreja, v_integracao.filial_id, v_job_id,
        v_data_vencimento, v_bandeira, v_tipo_lanc, v_lancamento,
        v_valor_liquido, NULLIF(v_item ->> 'valor_liquidado', '')::numeric,
        NULLIF(v_item ->> 'numero_cartao', ''), NULLIF(v_item ->> 'autorizacao', ''),
        v_nsu, NULLIF(v_item ->> 'terminal_logico', ''),
        v_data_venda, NULLIF(v_item ->> 'hora_venda', ''),
        NULLIF(v_item ->> 'valor_venda', '')::numeric,
        -- parcelas é integer (drift fechado em 20260807100000). CSV Getnet
        -- manda rótulo texto "N de M"; não há 2ª coluna pra total — grava NULL
        -- (mesmo estado 100% NULL das linhas reais em produção). Só aceita
        -- inteiro puro se algum dia o payload já vier normalizado.
        CASE
          WHEN NULLIF(v_item ->> 'parcelas', '') ~ '^[0-9]+$'
            THEN (v_item ->> 'parcelas')::integer
          ELSE NULL
        END,
        NULLIF(v_item ->> 'valor_parcela', '')::numeric,
        NULLIF(v_item ->> 'descontos', '')::numeric,
        NULLIF(v_item ->> 'valor_liquido_parcela', '')::numeric,
        NULLIF(v_item ->> 'data_contratacao_contrato', '')::date,
        NULLIF(v_item ->> 'instituicao_negociadora', ''),
        v_contrato,
        v_valor_atual_contrato,
        NULLIF(v_item ->> 'valor_liquidado_contrato', '')::numeric,
        NULLIF(v_item ->> 'valor_a_liquidar_contrato', '')::numeric,
        v_dedupe_key
      )
      ON CONFLICT (integracao_id, dedupe_key) DO NOTHING;

      GET DIAGNOSTICS v_novo = ROW_COUNT;
      IF v_novo THEN v_inseridos := v_inseridos + 1;
      ELSE v_duplicados := v_duplicados + 1; END IF;

      -- Upsert de lote por Contrato Registradora (Valor Atual Do Contrato é
      -- fixo repetido em toda linha do mesmo contrato — sobrescrever é seguro
      -- e idempotente; status NÃO é tocado para não reverter progresso da
      -- Fase B num reimport).
      IF v_contrato IS NOT NULL THEN
        INSERT INTO public.getnet_antecipacao_lotes (
          integracao_id, igreja_id, filial_id, contrato_registradora,
          instituicao_negociadora, data_contratacao_contrato, valor_atual_contrato
        ) VALUES (
          p_integracao_id, v_igreja, v_integracao.filial_id, v_contrato,
          NULLIF(v_item ->> 'instituicao_negociadora', ''),
          NULLIF(v_item ->> 'data_contratacao_contrato', '')::date,
          v_valor_atual_contrato
        )
        ON CONFLICT (igreja_id, contrato_registradora) DO UPDATE SET
          valor_atual_contrato = EXCLUDED.valor_atual_contrato,
          instituicao_negociadora = EXCLUDED.instituicao_negociadora,
          data_contratacao_contrato = EXCLUDED.data_contratacao_contrato,
          updated_at = now();
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_invalidos := v_invalidos + 1;
      v_warnings := v_warnings || left(SQLERRM, 120);
    END;
  END LOOP;

  UPDATE public.fin_extrato_ingestao_jobs
     SET inseridos = v_inseridos, duplicados = v_duplicados
   WHERE id = v_job_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_importar_recebivel_getnet', 'getnet_recebivel_lancamentos', v_job_id,
    jsonb_build_object('integracao_id', p_integracao_id, 'total', v_total),
    jsonb_build_object('job_id', v_job_id, 'inseridos', v_inseridos,
                       'duplicados', v_duplicados, 'invalidos', v_invalidos,
                       'subtotal_ignoradas', v_subtotal_ignoradas));

  RETURN jsonb_build_object('ok', true, 'job_id', v_job_id, 'total', v_total,
                            'inseridos', v_inseridos, 'duplicados', v_duplicados,
                            'invalidos', v_invalidos, 'subtotal_ignoradas', v_subtotal_ignoradas,
                            'warnings', to_jsonb(v_warnings));
END;
$$;

COMMENT ON FUNCTION public.fin_importar_recebivel_getnet(uuid, jsonb, jsonb) IS
  'Importa o CSV "Recebível Extrato Detalhado" (portal Getnet): dedupe por (integracao_id, dedupe_key) com contador de ocorrência, upsert de getnet_antecipacao_lotes por Contrato Registradora, job em fin_extrato_ingestao_jobs (origem getnet_recebivel_portal). Fase A — sem vínculo com extrato bancário nem lançamento de deságio.';

-- ─── 6. Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fin_importar_recebivel_getnet(uuid, jsonb, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_importar_recebivel_getnet(uuid, jsonb, jsonb) FROM anon;
