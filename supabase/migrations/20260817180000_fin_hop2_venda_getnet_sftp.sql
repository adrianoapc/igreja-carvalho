-- ============================================================================
-- Hop 2 (Oferta ↔ Venda) passa a considerar getnet_analitico (SFTP, tipo 2 —
-- comprovante de venda) além de getnet_recebivel_lancamentos (CSV do portal).
--
-- Prioridade confirmada pelo usuário (2026-08-17): SFTP é a fonte primária,
-- CSV vira só backup pra quando o SFTP falhar. O spike anterior
-- (docs/getnet-edi-vs-csv-hop2-spike.md) tinha ficado inconclusivo porque
-- rodou com dado de ANTES do cron do Getnet funcionar de verdade (corrigido
-- só em 13/08 — ver memória de sessão project-cron-jobs-nunca-funcionaram-
-- incidente). Revalidado no mesmo dia com o CSV oficial "Extrato Detalhado
-- de Cartão" do portal: bateu byte a byte (NSU, cartão truncado, valor) com
-- o que getnet_analitico já tinha capturado sozinho — cobertura 2/2 no dia,
-- com verificação de conteúdo.
--
-- Escopo desta migration: só Hop 2 (venda↔oferta). Hop 1 do crédito
-- (antecipação/deságio/contrato_registradora/lotes) continua 100%
-- dependente do CSV — decisão explícita do usuário, fica pra fase futura
-- (ver project-getnet-conciliacao-cartao-completo na memória de sessão).
-- Débito resolve 100% (liquida direto, sem antecipação); crédito resolve só
-- a sugestão/vínculo Hop 2, o ciclo de antecipação segue como hoje.
--
-- Mapeamento crédito/débito por codigo_produto vem da Tabela I (Código de
-- Produtos) do Manual Técnico Getnet (docs/Manual Extrato Eletronico_V10.1_
-- V6.2024.pdf, pg. 27) — não é heurística. Só os produtos plausíveis pra um
-- estabelecimento comum com cartão físico crédito/débito (SM/SV/EC/AC/HC =
-- crédito; SR/SE/ED = débito); convênio/crediário/carnê/voucher/pré-pago
-- ficam de fora (não fazem sentido pro caso de uso desta igreja, e a
-- direção de alguns não é óbvia na tabela).
--
-- NSU: CSV usa 9 dígitos zero-padded (confirmado em produção), SFTP usa 12
-- — mesmo NSU físico, formatação diferente. Normalizado via `ltrim(x, '0')`
-- em todo lugar que precisa comparar/agrupar entre as 2 fontes (grupos por
-- dia+direção+filial, e o check de bruto-por-NSU no writer) — garante que,
-- se um dia as 2 fontes tiverem overlap de período, a mesma venda física
-- não conta em dobro.
-- ============================================================================

-- ─── 1. Coluna de vínculo Hop 2 em getnet_analitico (mesmo padrão de
--        getnet_recebivel_lancamentos.transacao_financeira_id) ─────────────
ALTER TABLE public.getnet_analitico
  ADD COLUMN IF NOT EXISTS transacao_financeira_id uuid
    REFERENCES public.transacoes_financeiras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_getnet_analitico_transacao
  ON public.getnet_analitico(transacao_financeira_id)
  WHERE transacao_financeira_id IS NOT NULL;

COMMENT ON COLUMN public.getnet_analitico.transacao_financeira_id IS
  'Hop 2 (Oferta ↔ Venda), fonte SFTP: vínculo com transacoes_financeiras. Gravado por fin_vincular_venda_getnet_oferta (mesmo padrão de getnet_recebivel_lancamentos.transacao_financeira_id, fonte CSV). NULL = ainda não conciliado.';

CREATE INDEX IF NOT EXISTS idx_getnet_analitico_int_data
  ON public.getnet_analitico(integracao_id, data_transacao);

-- ─── 2. fin_gerar_candidatos_oferta_venda_getnet — soma as 2 fontes ────────
CREATE OR REPLACE FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(
  p_integracao_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_contexto jsonb DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL
)
RETURNS TABLE(
  data_venda date,
  direcao text,
  filial_id uuid,
  valor_bruto numeric,
  recebivel_ids uuid[],
  nsus text[],
  transacao_id uuid,
  score numeric,
  features jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_integracao record;
  v_scope uuid;
BEGIN
  IF p_integracao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_integracao_id é obrigatório';
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

  -- Escopo opcional de filial (UI "Todas" = NULL). Valida contra has_filial_access
  -- (não eq puro no JWT — admin_igreja / user_filial_access / registro global).
  IF p_filial_id IS NOT NULL THEN
    IF NOT public.has_filial_access(v_igreja, p_filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial solicitada';
    END IF;
    v_scope := p_filial_id;
  ELSE
    v_scope := NULL;
  END IF;

  RETURN QUERY
  WITH
  -- Linhas de venda elegíveis (ainda sem vínculo Hop 2), das 2 fontes.
  vendas AS (
    SELECT
      g.id,
      g.filial_id,
      g.data_venda,
      g.nsu,
      NULLIF(ltrim(g.nsu, '0'), '') AS nsu_norm,
      g.valor_venda,
      CASE
        WHEN COALESCE(g.bandeira_modalidade, '') ~* 'cr[eé]dito'
          OR COALESCE(g.lancamento, '') ~* 'cr[eé]dito'
          THEN 'credito'
        WHEN COALESCE(g.bandeira_modalidade, '') ~* 'd[eé]bito'
          OR COALESCE(g.lancamento, '') ~* 'd[eé]bito'
          THEN 'debito'
        ELSE NULL
      END AS direcao
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.integracao_id = p_integracao_id
     AND g.igreja_id = v_igreja
     AND g.transacao_financeira_id IS NULL
     AND g.data_venda IS NOT NULL
     AND g.data_venda BETWEEN p_periodo_inicio AND p_periodo_fim
     AND g.nsu IS NOT NULL
     AND g.nsu <> ''
     AND g.valor_venda IS NOT NULL
     AND public.has_filial_access(v_igreja, g.filial_id)
     AND (
       v_scope IS NULL
       OR g.filial_id IS NULL
       OR g.filial_id = v_scope
     )
    UNION ALL
    -- Fonte SFTP (tipo 2, EDI): o registro de venda não carrega a direção —
    -- vem do codigo_produto do RV correspondente em getnet_resumo (tipo 1),
    -- via Tabela I do manual (comentário no topo do arquivo).
    SELECT
      ga.id,
      ga.filial_id,
      ga.data_transacao AS data_venda,
      ga.nsu_cv AS nsu,
      NULLIF(ltrim(ga.nsu_cv, '0'), '') AS nsu_norm,
      ga.valor_transacao AS valor_venda,
      CASE
        WHEN (
          SELECT gr.codigo_produto FROM public.getnet_resumo gr
           WHERE gr.integracao_id = ga.integracao_id AND gr.rv = ga.rv
           LIMIT 1
        ) IN ('SM', 'SV', 'EC', 'AC', 'HC') THEN 'credito'
        WHEN (
          SELECT gr.codigo_produto FROM public.getnet_resumo gr
           WHERE gr.integracao_id = ga.integracao_id AND gr.rv = ga.rv
           LIMIT 1
        ) IN ('SR', 'SE', 'ED') THEN 'debito'
        ELSE NULL
      END AS direcao
    FROM public.getnet_analitico ga
   WHERE ga.integracao_id = p_integracao_id
     AND ga.igreja_id = v_igreja
     AND ga.transacao_financeira_id IS NULL
     AND ga.data_transacao IS NOT NULL
     AND ga.data_transacao BETWEEN p_periodo_inicio AND p_periodo_fim
     AND ga.nsu_cv IS NOT NULL
     AND ga.nsu_cv <> ''
     AND ga.valor_transacao IS NOT NULL
     AND public.has_filial_access(v_igreja, ga.filial_id)
     AND (
       v_scope IS NULL
       OR ga.filial_id IS NULL
       OR ga.filial_id = v_scope
     )
  ),
  -- Por NSU normalizado: valor uma vez (CSV real repete o bruto em cada
  -- parcela; normalização evita contar em dobro se as 2 fontes um dia
  -- tiverem overlap de período pro mesmo NSU físico).
  por_nsu AS (
    SELECT
      v.data_venda,
      v.direcao,
      v.filial_id,
      v.nsu_norm,
      MAX(v.valor_venda) AS valor_venda
    FROM vendas v
   WHERE v.direcao IS NOT NULL
     AND v.nsu_norm IS NOT NULL
   GROUP BY v.data_venda, v.direcao, v.filial_id, v.nsu_norm
  ),
  -- Agrupa o dia + direção + filial (oferta do culto costuma ser 1 lançamento
  -- por direção naquela filial).
  grupos AS (
    SELECT
      v.data_venda,
      v.direcao,
      v.filial_id,
      (SELECT SUM(p.valor_venda)
         FROM por_nsu p
        WHERE p.data_venda = v.data_venda
          AND p.direcao = v.direcao
          AND p.filial_id IS NOT DISTINCT FROM v.filial_id) AS valor_bruto,
      array_agg(v.id ORDER BY v.id) AS recebivel_ids,
      array_agg(DISTINCT v.nsu ORDER BY v.nsu) AS nsus
    FROM vendas v
   WHERE v.direcao IS NOT NULL
     AND v.nsu_norm IS NOT NULL
   GROUP BY v.data_venda, v.direcao, v.filial_id
  ),
  -- Ofertas candidatas (entrada cartão, não conciliadas).
  ofertas AS (
    SELECT
      t.id,
      t.filial_id,
      t.data_vencimento,
      t.valor,
      CASE
        WHEN COALESCE(fp.nome, t.forma_pagamento, '') ~* 'cr[eé]dito' THEN 'credito'
        WHEN COALESCE(fp.nome, t.forma_pagamento, '') ~* 'd[eé]bito' THEN 'debito'
        ELSE NULL
      END AS direcao_forma
    FROM public.transacoes_financeiras t
    LEFT JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
   WHERE t.igreja_id = v_igreja
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.conciliacao_status = 'nao_conciliado'
     AND COALESCE(fp.nome, t.forma_pagamento, '') ILIKE '%cart%'
     AND t.data_vencimento BETWEEN (p_periodo_inicio - 1) AND (p_periodo_fim + 1)
     AND public.has_filial_access(v_igreja, t.filial_id)
     AND (
       v_scope IS NULL
       OR t.filial_id IS NULL
       OR t.filial_id = v_scope
     )
  ),
  matches AS (
    SELECT
      g.data_venda,
      g.direcao,
      g.filial_id,
      g.valor_bruto,
      g.recebivel_ids,
      g.nsus,
      o.id AS transacao_id,
      CASE
        WHEN o.data_vencimento = g.data_venda
         AND abs(o.valor - g.valor_bruto) <= 0.01 THEN 1.0::numeric
        WHEN abs(o.data_vencimento - g.data_venda) = 1
         AND abs(o.valor - g.valor_bruto) <= 0.01 THEN 0.85::numeric
        ELSE NULL
      END AS score,
      jsonb_build_object(
        'valor_oferta', o.valor,
        'data_vencimento', o.data_vencimento,
        'delta_dias', (o.data_vencimento - g.data_venda),
        'delta_valor', (o.valor - g.valor_bruto),
        'direcao_forma', o.direcao_forma,
        'filial_oferta', o.filial_id,
        'n_recebiveis', coalesce(array_length(g.recebivel_ids, 1), 0),
        'n_nsus', coalesce(array_length(g.nsus, 1), 0)
      ) AS features
    FROM grupos g
    JOIN ofertas o
      ON abs(o.valor - g.valor_bruto) <= 0.01
     AND abs(o.data_vencimento - g.data_venda) <= 1
     -- Não mistura crédito/débito: se a forma declara direção, tem que bater.
     AND (o.direcao_forma IS NULL OR o.direcao_forma = g.direcao)
     -- Filial: oferta global casa com qualquer grupo; senão tem que bater.
     AND (o.filial_id IS NULL OR g.filial_id IS NULL OR o.filial_id = g.filial_id)
  )
  SELECT
    m.data_venda,
    m.direcao,
    m.filial_id,
    m.valor_bruto,
    m.recebivel_ids,
    m.nsus,
    m.transacao_id,
    m.score,
    m.features
  FROM matches m
  WHERE m.score IS NOT NULL
  ORDER BY m.score DESC, m.data_venda, m.direcao, m.transacao_id;
END;
$$;

COMMENT ON FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(uuid, date, date, jsonb, uuid) IS
  'Hop 2 (só leitura): agrupa vendas de 2 fontes — getnet_recebivel_lancamentos (CSV, backup) e getnet_analitico (SFTP tipo 2, primária) — por data_venda+direção (valor 1× por NSU normalizado), casa contra ofertas cartão nao_conciliadas. Direção da fonte SFTP vem do codigo_produto do RV em getnet_resumo (Tabela I do manual). has_filial_access na integração, em cada venda (das 2 fontes) e em cada oferta.';

-- ─── 3. fin_vincular_venda_getnet_oferta — grava o vínculo na fonte certa ──
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

  -- Lock oferta + recebíveis (das 2 fontes possíveis) em ordem de id (evita
  -- deadlock — mesma ordem de tabelas sempre: transacoes_financeiras,
  -- getnet_recebivel_lancamentos, getnet_analitico).
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

  -- Trava recebíveis nas 2 tabelas — ids são uuid globais, cada um só
  -- existe em UMA das duas; travar as duas é seguro (no-op na que não tem
  -- o id) e evita ter que descobrir a origem de cada id antes de travar.
  PERFORM 1
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids)
   ORDER BY g.id
   FOR NO KEY UPDATE;

  PERFORM 1
    FROM public.getnet_analitico ga
   WHERE ga.id = ANY (v_ids)
   ORDER BY ga.id
   FOR NO KEY UPDATE;

  SELECT count(*) INTO v_n
    FROM (
      SELECT g.id FROM public.getnet_recebivel_lancamentos g WHERE g.id = ANY (v_ids)
      UNION ALL
      SELECT ga.id FROM public.getnet_analitico ga WHERE ga.id = ANY (v_ids)
    ) x;
  IF v_n IS DISTINCT FROM array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: um ou mais recebíveis inexistentes';
  END IF;

  -- Valida cada recebível (tenant / filial / ainda livre / venda real) —
  -- fonte CSV.
  FOR v_rec IN
    SELECT g.id, g.igreja_id, g.filial_id, g.transacao_financeira_id, g.nsu, g.valor_venda
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

  -- Mesma validação, fonte SFTP (getnet_analitico) — nsu_cv/valor_transacao
  -- no lugar de nsu/valor_venda.
  FOR v_rec IN
    SELECT ga.id, ga.igreja_id, ga.filial_id, ga.transacao_financeira_id,
           ga.nsu_cv AS nsu, ga.valor_transacao AS valor_venda
      FROM public.getnet_analitico ga
     WHERE ga.id = ANY (v_ids)
     ORDER BY ga.id
  LOOP
    IF v_rec.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: venda (SFTP) % fora do tenant', v_rec.id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_rec.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da venda (SFTP) %', v_rec.id;
    END IF;
    IF v_rec.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_rec.filial_id = ANY (v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_rec.filial_id;
    END IF;
    IF v_rec.transacao_financeira_id IS NOT NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: venda (SFTP) % já vinculada a %',
        v_rec.id, v_rec.transacao_financeira_id;
    END IF;
    IF v_rec.nsu IS NULL OR v_rec.nsu = '' OR v_rec.valor_venda IS NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: venda (SFTP) % não é linha de venda válida (nsu_cv/valor_transacao)',
        v_rec.id;
    END IF;
  END LOOP;

  -- Filial mista: rejeita ≥2 filiais concretas sem âncora compartilhada
  -- (filial_id IS NULL). Mesma regra de fin_confirmar_conciliacao (§9.86).
  IF coalesce(array_length(v_filiais_distintas, 1), 0) > 1
     AND NOT v_tem_filial_compartilhada THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: oferta e recebíveis de filiais diferentes não podem ser vinculados juntos';
  END IF;

  -- Detecção de parcelamento via g.parcelas DESATIVADA (hotfix 2026-08-07,
  -- ver 20260807100000_fin_getnet_recebivel_parcelas_integer_drift.sql) —
  -- g.parcelas virou integer, produção nunca teve de fato o rótulo texto
  -- "k de N". v_parcelado fica sempre false — segue o caminho à vista.
  -- getnet_analitico nunca alimenta este bloco (numero_parcelas/parcela_do_cv
  -- existem na tabela mas não são lidos aqui — fora de escopo desta fase,
  -- mesmo critério do CSV: sem dado confiável de "atual DE total").
  SELECT count(DISTINCT nsu) INTO v_nsu_count
    FROM (
      SELECT g.nsu FROM public.getnet_recebivel_lancamentos g WHERE g.id = ANY (v_ids)
      UNION ALL
      SELECT ga.nsu_cv FROM public.getnet_analitico ga WHERE ga.id = ANY (v_ids)
    ) x;

  IF v_nsu_count = 1 THEN
    SELECT nsu INTO v_nsu
      FROM (
        SELECT g.nsu FROM public.getnet_recebivel_lancamentos g WHERE g.id = ANY (v_ids)
        UNION ALL
        SELECT ga.nsu_cv FROM public.getnet_analitico ga WHERE ga.id = ANY (v_ids)
      ) x
     LIMIT 1;
  END IF;

  v_parcelado := false;
  v_total_parcelas := 1;

  IF v_parcelado THEN
    -- Bloco 2b (parcelado) inalcançável — inerte, ver comentário acima.
    -- Preservado igual ao original (só fonte CSV; nunca reativado sem
    -- reescrever a detecção do zero, como já valia antes desta migration).
    IF v_n_distintas IS DISTINCT FROM v_total_parcelas
       OR v_min_parcela IS DISTINCT FROM 1
       OR v_max_parcela IS DISTINCT FROM v_total_parcelas
       OR array_length(v_ids, 1) IS DISTINCT FROM v_total_parcelas THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: parcelas incompletas do NSU % (recebidos %, esperado 1..%)',
        v_nsu, array_length(v_ids, 1), v_total_parcelas;
    END IF;

    v_pai := p_transacao_id;
    PERFORM 1
      FROM public.transacoes_financeiras t
     WHERE t.id = v_pai OR t.lancamento_pai_id = v_pai
     ORDER BY t.id
     FOR NO KEY UPDATE;

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

    FOR v_linha IN
      SELECT g.*,
             (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int AS num_parc
        FROM public.getnet_recebivel_lancamentos g
       WHERE g.id = ANY (v_ids)
         AND (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int > 1
       ORDER BY (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int, g.id
    LOOP
      v_taxas := abs(COALESCE(v_linha.descontos, 0));
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
    -- ─── Caminho à vista (1 de 1 / vários NSUs à vista) — as 2 fontes ─────
    WITH agg AS (
      SELECT
        abs(COALESCE(g.descontos, 0)) AS taxa,
        COALESCE(g.valor_liquido_parcela,
                 COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))) AS liquido,
        g.data_vencimento AS data_pag
        FROM public.getnet_recebivel_lancamentos g
       WHERE g.id = ANY (v_ids)
      UNION ALL
      -- Fonte SFTP: valor_comissao já bate com getnet_resumo.valor_taxa_desconto
      -- da mesma RV (confirmado com dado real, 2026-08-17). data_pagamento_rv
      -- (tipo 1) faz o papel de data_vencimento do recebível CSV.
      SELECT
        COALESCE(ga.valor_comissao, 0) AS taxa,
        ga.valor_transacao - COALESCE(ga.valor_comissao, 0) AS liquido,
        (SELECT gr.data_pagamento_rv FROM public.getnet_resumo gr
          WHERE gr.integracao_id = ga.integracao_id AND gr.rv = ga.rv
          LIMIT 1) AS data_pag
        FROM public.getnet_analitico ga
       WHERE ga.id = ANY (v_ids)
    )
    SELECT COALESCE(SUM(taxa), 0), COALESCE(SUM(liquido), 0), MAX(data_pag)
      INTO v_taxas, v_liquido, v_data_pag
      FROM agg;

    -- Confere bruto (1× por NSU normalizado, das 2 fontes) ≈ valor da oferta (±0,01).
    SELECT COALESCE(SUM(v), 0) INTO v_bruto_nsu
      FROM (
        SELECT NULLIF(ltrim(x.nsu, '0'), '') AS nsu_norm, MAX(x.valor) AS v
          FROM (
            SELECT g.nsu, g.valor_venda AS valor
              FROM public.getnet_recebivel_lancamentos g WHERE g.id = ANY (v_ids)
            UNION ALL
            SELECT ga.nsu_cv, ga.valor_transacao
              FROM public.getnet_analitico ga WHERE ga.id = ANY (v_ids)
          ) x
         GROUP BY nsu_norm
      ) s;

    IF abs(v_bruto_nsu - v_trx.valor) > 0.01 THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: bruto Getnet (%) diverge do valor da oferta (%)',
        v_bruto_nsu, v_trx.valor;
    END IF;

    UPDATE public.getnet_recebivel_lancamentos
       SET transacao_financeira_id = p_transacao_id
     WHERE id = ANY (v_ids);

    UPDATE public.getnet_analitico
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
  'Hop 2: vincula vendas (CSV getnet_recebivel_lancamentos OU SFTP getnet_analitico — ids globais, cada um só existe numa das 2 tabelas) à oferta, atualiza taxa/líquido/pagamento via fin_atualizar_lancamento, marca conciliado_manual. Fonte SFTP usa valor_comissao como taxa e data_pagamento_rv do RV (getnet_resumo) como data de pagamento. Parcelamento (Fase 2b) só considera CSV, inerte desde 20260807100000 (sem dado real de "N de M"). has_filial_access na oferta e em cada venda das 2 fontes; filial mista só com âncora compartilhada (guardrail #13).';

-- ─── 4. fin_listar_ledger_conciliacao_cartao — reconhece recebíveis SFTP ───
-- Só o necessário pro Hop 2 aparecer certo no ledger (recebiveis_grupo):
-- linha ligada por getnet_analitico entra na contagem/exibição igual à do
-- CSV. hop1_status fica 'aguardando' pra essas (sem contrato_registradora/
-- extrato_bancario_id — Hop 1/antecipação do crédito via SFTP é fora de
-- escopo desta fase, decisão do usuário) — resultado correto: sai de
-- "sem_hop2", fica em "aguardando_banco" até uma fase futura de Hop 1.
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
  -- ─── Recebíveis Getnet já casados (Hop 2 feito) com cada membro — 2 fontes ─
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
    UNION ALL
    -- Fonte SFTP: sem contrato_registradora/extrato_bancario_id (Hop 1 do
    -- crédito via SFTP é fase futura) — hop1_status cai em 'aguardando'
    -- naturalmente, o que já é o comportamento certo pro escopo desta fase.
    SELECT
      m.grupo_id,
      ga.id AS recebivel_id,
      ga.nsu_cv AS nsu,
      ga.valor_transacao - COALESCE(ga.valor_comissao, 0) AS valor_liquido,
      (SELECT gr.data_pagamento_rv FROM public.getnet_resumo gr
        WHERE gr.integracao_id = ga.integracao_id AND gr.rv = ga.rv
        LIMIT 1) AS data_vencimento_real,
      NULL::uuid AS extrato_bancario_id,
      NULL::text AS contrato_registradora,
      COALESCE(m.numero_parcela, 1) AS numero_parcela,
      COALESCE(m.total_parcelas, 1) AS total_parcelas
    FROM membros m
    JOIN public.getnet_analitico ga
      ON ga.transacao_financeira_id = m.trans_id
     AND ga.igreja_id = v_igreja
     AND ga.integracao_id = p_integracao_id
     AND public.has_filial_access(v_igreja, ga.filial_id)
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
          'numero_parcela', COALESCE(ot.numero_parcela, 1),
          'total_parcelas', COALESCE(ot.total_parcelas, 1),
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
  'Ledger unificado Oferta→Venda→Banco + lotes de antecipação. recebiveis_grupo une as 2 fontes de venda (CSV getnet_recebivel_lancamentos, SFTP getnet_analitico) — SFTP entra sem contrato_registradora/extrato_bancario_id (Hop 1 do crédito via SFTP é fase futura), hop1_status fica "aguardando" naturalmente. Sugestão Hop 2 via fin_gerar_candidatos_oferta_venda_getnet (já soma as 2 fontes). Resto do comportamento (divergência, lotes, HFA) inalterado desde 20260807100000.';

GRANT EXECUTE ON FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(uuid, date, date, jsonb, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(uuid, date, date, jsonb, uuid)
  FROM anon;

GRANT EXECUTE ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb)
  FROM anon;

GRANT EXECUTE ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid)
  FROM anon;
