-- ============================================================================
-- Motor central de conciliação (F4/ADR-030) para de casar contra o espelho
-- sintético do próprio Getnet — extensão da C2-7 (fase separada, não faz
-- parte do plano Ciclo 2 numerado; achado durante a pesquisa pré-cutover
-- da C2-8, decisão explícita do usuário: corrigir isto ANTES do cutover
-- pra getnet_credito_disponivel).
--
-- Achado: `fin_gerar_candidatos_conciliacao` (o motor ÚNICO de candidatos
-- pra Modo Inteligente, Modo Clássico via fin_listar_extratos_sem_candidato,
-- a aba Dashboard legada e a edge gerar-sugestoes-ml) NUNCA filtrava
-- `extratos_bancarios.origem` — exatamente o mesmo bug que a C2-7 corrigiu
-- em fin_gerar_candidatos_venda_banco_getnet/fin_gerar_candidatos_lote_
-- antecipacao_getnet, só que aqui é o motor que atende TODOS os bancos, não
-- só Getnet, e o caminho de escrita (fin_confirmar_conciliacao) já é
-- transacional — uma venda Getnet podia ser confirmada como o lado bancário
-- de uma transação real qualquer, silenciosamente, por QUALQUER um dos 4
-- caminhos que chamam este motor.
--
-- Mesmo helper da C2-7 (`public.fin_e_espelho_getnet(origem) RETURNS
-- boolean`, já existe desde `20260812130000`) — não reimplementa a lista.
--
-- Fix cirúrgico, mesmo padrão: exclui a origem espelho do pool de
-- candidatos (leitura) nos 2 motores; exclui também das 2 fontes de
-- estatística que contam extratos_bancarios sem filtrar origem
-- (view_reconciliacao_cobertura no banco, "Banco" stats card do
-- HistoricoExtratos.tsx no frontend — commit separado) e do fluxo manual de
-- lote N:1 (useConciliacaoLote.ts, commit separado) — nenhum desses grava
-- nada sozinho, mas contavam/ofereciam o espelho como se fosse crédito
-- bancário real.
-- ============================================================================

-- ─── 1. fin_gerar_candidatos_conciliacao — motor único ─────────────────────
CREATE OR REPLACE FUNCTION public.fin_gerar_candidatos_conciliacao(
  p_conta_id uuid DEFAULT NULL,
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL,
  p_score_minimo numeric DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL,
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  extrato_id uuid,
  transacao_ids uuid[],
  tipo_match text,
  score numeric,
  features jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_filial uuid;
  v_scope uuid;
  v_pode_todas boolean;
  v_ini date;
  v_fim date;
  v_corte numeric;
BEGIN
  -- Tenant/ator: igreja derivada do contexto (JWT ou service role validado),
  -- guarda admin|tesoureiro imposta em fin_resolver_contexto.
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  -- Escopo efetivo de filial (padrão F2.5), conciliando dois requisitos:
  --  (a) usuário restrito a uma filial NUNCA amplia o escopo passando NULL;
  --  (b) usuário com acesso amplo à igreja (admin/admin_igreja/super_admin) vê
  --      TODAS as filiais quando escolhe "Todas" (p_filial_id NULL), mesmo tendo
  --      uma filial default no JWT — não pode ser estreitado ao default.
  -- p_filial_id explícito é sempre validado por has_filial_access.
  -- Papel amplo é POR IGREJA (user_roles.igreja_id); igreja_id NULL = papel
  -- global (super_admin). Sem o recorte por igreja, um usuário admin na igreja A
  -- e restrito a uma filial na igreja B veria todas as filiais de B.
  v_pode_todas := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
       AND (ur.igreja_id = v_igreja OR ur.igreja_id IS NULL)
  );
  IF p_filial_id IS NOT NULL THEN
    -- Validação recortada por igreja — NÃO usa has_filial_access, cujo atalho
    -- global has_role('admin') é satisfeito por admin_igreja/admin_filial de
    -- QUALQUER igreja (vazaria filial de outra igreja no cenário multi-igreja).
    -- (a) a filial precisa pertencer à igreja resolvida;
    IF NOT EXISTS (
      SELECT 1 FROM public.filiais f
       WHERE f.id = p_filial_id AND f.igreja_id = v_igreja
    ) THEN
      RAISE EXCEPTION 'FIN_TENANT: filial fora do tenant';
    END IF;
    -- (b) papel amplo NESTA igreja pode ver qualquer filial; caso contrário só
    --     a própria filial do usuário.
    IF NOT (v_pode_todas OR p_filial_id = v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
    v_scope := p_filial_id;          -- filial escolhida na tela
  ELSIF v_pode_todas THEN
    v_scope := NULL;                 -- "Todas" para quem enxerga a igreja toda
  ELSE
    v_scope := v_filial;             -- restrito à própria filial
  END IF;

  v_ini := COALESCE(p_periodo_inicio, date_trunc('month', CURRENT_DATE)::date);
  v_fim := COALESCE(p_periodo_fim, (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date);

  -- Corte: parâmetro explícito › config da filial (escopo) › config da igreja
  -- (filial_id NULL) › default 0.6. A linha específica da filial tem prioridade
  -- sobre a linha global (ORDER BY filial_id NULLS LAST = não-nulo primeiro);
  -- ignora linhas com score nulo para não mascarar um fallback válido.
  v_corte := COALESCE(
    p_score_minimo,
    (SELECT fc.conciliacao_score_minimo
       FROM public.financeiro_config fc
      WHERE fc.igreja_id = v_igreja
        AND (fc.filial_id = v_scope OR fc.filial_id IS NULL)
        AND fc.conciliacao_score_minimo IS NOT NULL
      ORDER BY fc.filial_id NULLS LAST
      LIMIT 1),
    0.6
  );

  RETURN QUERY
  WITH candidatos_1x1 AS (
    SELECT
      e.id AS extrato_id,
      ARRAY[t.id] AS transacao_ids,
      '1:1'::text AS tipo_match,
      (
        CASE
          WHEN e.valor = t.valor THEN 0.4
          WHEN e.valor = 0 THEN 0.0
          ELSE 0.4 * (1.0 - (ABS(e.valor - t.valor) / GREATEST(ABS(e.valor), ABS(t.valor))))
        END +
        CASE
          WHEN ABS(e.data_transacao - td.dref) = 0 THEN 0.3
          WHEN ABS(e.data_transacao - td.dref) <= 3 THEN 0.24
          WHEN ABS(e.data_transacao - td.dref) <= 7 THEN 0.15
          ELSE 0.06
        END +
        CASE
          WHEN (e.tipo = 'credito' AND t.tipo = 'entrada') OR (e.tipo = 'debito' AND t.tipo = 'saida') THEN 0.1
          ELSE 0.0
        END +
        COALESCE((
          SELECT (COUNT(DISTINCT word)::float / GREATEST(
            (SELECT COUNT(*) FROM unnest(string_to_array(LOWER(REGEXP_REPLACE(e.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' '))),
            (SELECT COUNT(*) FROM unnest(string_to_array(LOWER(REGEXP_REPLACE(t.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' '))),
            1
          )) * 0.2
          FROM (
            SELECT unnest(string_to_array(LOWER(REGEXP_REPLACE(e.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' ')) AS word
            INTERSECT
            SELECT unnest(string_to_array(LOWER(REGEXP_REPLACE(t.descricao, '[^a-zA-Z0-9\s]', '', 'g')), ' ')) AS word
          ) AS overlap
        ), 0)
      )::numeric(5,4) AS score,
      jsonb_build_object(
        'extrato_valor', e.valor,
        'transacao_valor', t.valor,
        'diferenca_valor', ABS(e.valor - t.valor),
        'diferenca_dias', ABS(e.data_transacao - td.dref),
        'match_tipo', (e.tipo = 'credito' AND t.tipo = 'entrada') OR (e.tipo = 'debito' AND t.tipo = 'saida'),
        'categoria_id', t.categoria_id,
        'status', t.status
      ) AS features
    FROM extratos_bancarios e
    INNER JOIN transacoes_financeiras t ON
      e.igreja_id = t.igreja_id
      AND e.conta_id = t.conta_id
      AND (e.filial_id = t.filial_id OR e.filial_id IS NULL OR t.filial_id IS NULL)
    -- data de referência: pagamento (pago) ou vencimento (pendente)
    CROSS JOIN LATERAL (SELECT COALESCE(t.data_pagamento, t.data_vencimento) AS dref) td
    WHERE
      e.igreja_id = v_igreja
      -- Reimpõe o escopo de filial (SECURITY DEFINER bypassa RLS): treasurer de
      -- uma filial não recebe candidatos de outra. Com filial concreta (v_scope
      -- não nulo) NÃO inclui linhas de filial NULL (a tela filtra por
      -- .eq('filial_id', ...) e a auto-conciliação aplica direto — não pode
      -- mutar registros da igreja que não aparecem na visão da filial). v_scope
      -- NULL = acesso amplo → todas as filiais (inclui as de filial NULL).
      AND (v_scope IS NULL OR e.filial_id = v_scope)
      AND (v_scope IS NULL OR t.filial_id = v_scope)
      AND (p_conta_id IS NULL OR e.conta_id = p_conta_id)
      AND e.reconciliado = false
      AND e.transacao_vinculada_id IS NULL
      -- Achado pré-C2-8: o espelho sintético do próprio Getnet não é um
      -- crédito/débito bancário real — mesma razão da C2-7 (venda casando
      -- com a própria sombra), aqui aplicada ao motor central que atende
      -- TODOS os bancos, não só Getnet. `origem IS NULL OR NOT ...`, não só
      -- `NOT fin_e_espelho_getnet(...)` (achado do code-review — o comentário
      -- original desta linha estava ERRADO: fin_e_espelho_getnet(NULL) é
      -- `NULL IN (...)` = NULL, `NOT NULL` = NULL, e WHERE descarta NULL
      -- igual a FALSE — um extrato real com origem NULL sumiria do pool
      -- silenciosamente, exatamente a armadilha do guardrail §9.62 item 3
      -- que a C2-7 já tinha evitado corretamente nesta mesma função-irmã).
      AND (e.origem IS NULL OR NOT public.fin_e_espelho_getnet(e.origem))
      -- Inclui pendentes: fin_confirmar_conciliacao baixa pendente→pago na
      -- conciliação; pendente casa pela data_vencimento (td.dref).
      AND t.status IN ('pendente', 'pago')
      -- Direção OBRIGATÓRIA (crédito↔entrada, débito↔saída): sem isso um saque
      -- concilia com uma receita quando valor+data batem (score 0.7 ≥ corte). A
      -- legada reconciliar_transacoes exigia; os fluxos auto-aplicam, então é
      -- filtro rígido, não só peso de 0.1 no score.
      AND ((e.tipo = 'credito' AND t.tipo = 'entrada') OR (e.tipo = 'debito' AND t.tipo = 'saida'))
      -- Apenas transações não conciliadas por NENHUM meio (extrato, bot ou
      -- manual/conferência de caixa) — os fluxos automáticos aplicam estas
      -- linhas direto e não podem sobrescrever uma conciliação já existente.
      AND COALESCE(t.conciliacao_status, 'nao_conciliado') = 'nao_conciliado'
      AND e.data_transacao BETWEEN v_ini AND v_fim
      AND td.dref BETWEEN v_ini - INTERVAL '30 days' AND v_fim + INTERVAL '30 days'
      AND ABS(e.data_transacao - td.dref) <= 30
      AND NOT EXISTS (
        SELECT 1 FROM conciliacoes_lote cl WHERE cl.transacao_id = t.id
      )
  ),
  candidatos_1xN AS (
    SELECT
      e.id AS extrato_id,
      array_agg(t.id ORDER BY td.dref) AS transacao_ids,
      '1:N'::text AS tipo_match,
      (
        CASE WHEN ABS(e.valor - SUM(t.valor)) < 0.01 THEN 0.8 ELSE 0.0 END +
        CASE
          WHEN AVG(ABS(e.data_transacao - td.dref)) <= 3 THEN 0.2
          WHEN AVG(ABS(e.data_transacao - td.dref)) <= 7 THEN 0.1
          ELSE 0.05
        END
      )::numeric(5,4) AS score,
      jsonb_build_object(
        'extrato_valor', e.valor,
        'transacao_valor_total', SUM(t.valor),
        'qtd_transacoes', COUNT(t.id),
        'diferenca_dias_media', AVG(ABS(e.data_transacao - td.dref))::integer
      ) AS features
    FROM extratos_bancarios e
    INNER JOIN transacoes_financeiras t ON
      e.igreja_id = t.igreja_id
      AND e.conta_id = t.conta_id
      AND (e.filial_id = t.filial_id OR e.filial_id IS NULL OR t.filial_id IS NULL)
    CROSS JOIN LATERAL (SELECT COALESCE(t.data_pagamento, t.data_vencimento) AS dref) td
    WHERE
      e.igreja_id = v_igreja
      AND (v_scope IS NULL OR e.filial_id = v_scope)
      AND (v_scope IS NULL OR t.filial_id = v_scope)
      AND (p_conta_id IS NULL OR e.conta_id = p_conta_id)
      AND e.reconciliado = false
      AND e.transacao_vinculada_id IS NULL
      -- Mesmo achado pré-C2-8 do CTE 1x1 acima (guarda de NULL incluída).
      AND (e.origem IS NULL OR NOT public.fin_e_espelho_getnet(e.origem))
      AND t.status IN ('pendente', 'pago')
      AND ((e.tipo = 'credito' AND t.tipo = 'entrada') OR (e.tipo = 'debito' AND t.tipo = 'saida'))
      AND COALESCE(t.conciliacao_status, 'nao_conciliado') = 'nao_conciliado'
      AND e.data_transacao BETWEEN v_ini AND v_fim
      AND td.dref BETWEEN e.data_transacao - INTERVAL '7 days' AND e.data_transacao + INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM conciliacoes_lote cl WHERE cl.transacao_id = t.id
      )
    GROUP BY e.id, e.valor, e.data_transacao
    HAVING
      COUNT(t.id) BETWEEN 2 AND 10
      AND ABS(e.valor - SUM(t.valor)) < 0.01
  )
  SELECT r.extrato_id, r.transacao_ids, r.tipo_match, r.score, r.features
  FROM (
    SELECT * FROM candidatos_1x1
    UNION ALL
    SELECT * FROM candidatos_1xN
  ) AS r
  WHERE r.score >= v_corte
  ORDER BY r.score DESC, r.tipo_match;
END;
$$;

COMMENT ON FUNCTION public.fin_gerar_candidatos_conciliacao(uuid, date, date, numeric, uuid, jsonb) IS
  'Motor ÚNICO de candidatos de conciliação (ADR-030 F4). Score 0..1 (valor 0.4/data 0.3/descrição 0.2/tipo 0.1), formatos 1:1 e 1:N. Tenant/ator via fin_resolver_contexto; corte por igreja em financeiro_config.conciliacao_score_minimo. Exclui origem espelho Getnet (achado pré-C2-8, mesma razão da C2-7 — fin_e_espelho_getnet). Confirmação via fin_confirmar_conciliacao.';

-- ─── 2. fin_listar_extratos_sem_candidato — Modo Clássico ──────────────────
CREATE OR REPLACE FUNCTION public.fin_listar_extratos_sem_candidato(
  p_conta_id uuid DEFAULT NULL,
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL,
  p_score_minimo numeric DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL,
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  extrato_id uuid,
  data_transacao date,
  descricao text,
  valor numeric,
  tipo text,
  conta_id uuid,
  origem text,
  possivel_duplicata_de uuid,
  motivo text
)
LANGUAGE plpgsql
-- Sem STABLE: chama fin_gerar_candidatos_conciliacao, que não declara
-- volatilidade (default VOLATILE) — marcar STABLE aqui seria um contrato
-- inexato com a chamadora. Achado do code-review da C2-1.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_filial uuid;
  v_scope uuid;
  v_pode_todas boolean;
  v_ini date;
  v_fim date;
BEGIN
  -- Mesma resolução de tenant/ator/filial que fin_gerar_candidatos_conciliacao
  -- (F4) — precisa bater exatamente, senão "sem candidato aqui" poderia
  -- divergir do que a tela Inteligente calcula pro mesmo extrato.
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  v_pode_todas := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
       AND (ur.igreja_id = v_igreja OR ur.igreja_id IS NULL)
  );
  IF p_filial_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.filiais f
       WHERE f.id = p_filial_id AND f.igreja_id = v_igreja
    ) THEN
      RAISE EXCEPTION 'FIN_TENANT: filial fora do tenant';
    END IF;
    IF NOT (v_pode_todas OR p_filial_id = v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
    v_scope := p_filial_id;
  ELSIF v_pode_todas THEN
    v_scope := NULL;
  ELSE
    v_scope := v_filial;
  END IF;

  v_ini := COALESCE(p_periodo_inicio, date_trunc('month', CURRENT_DATE)::date);
  v_fim := COALESCE(p_periodo_fim, (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date);

  RETURN QUERY
  WITH candidatos AS (
    -- Chama a F4 inteira como função de tabela — mesmo p_contexto/p_score_minimo,
    -- resolve corte e candidatos sozinha, sem duplicação.
    SELECT DISTINCT c.extrato_id
    FROM public.fin_gerar_candidatos_conciliacao(
      p_conta_id, v_ini, v_fim, p_score_minimo, p_filial_id, p_contexto
    ) c
  )
  SELECT
    e.id,
    e.data_transacao,
    e.descricao,
    e.valor,
    e.tipo,
    e.conta_id,
    e.origem,
    e.possivel_duplicata_de,
    CASE
      WHEN e.origem ILIKE '%getnet%' THEN 'venda_getnet_sem_vinculo_confirmado'
      ELSE 'sem_transacao_compativel_no_periodo'
    END AS motivo
  FROM public.extratos_bancarios e
  WHERE
    e.igreja_id = v_igreja
    -- Filial compartilhada (filial_id IS NULL) precisa continuar visível com
    -- filial concreta selecionada — RPC de LEITURA (guardrail financeiro:
    -- ".eq() puro" só se justifica quando o objetivo é travar escrita fora
    -- do escopo, não aqui). Achado do code-review da C2-1.
    AND (v_scope IS NULL OR e.filial_id = v_scope OR e.filial_id IS NULL)
    AND (p_conta_id IS NULL OR e.conta_id = p_conta_id)
    AND e.reconciliado = false
    AND e.transacao_vinculada_id IS NULL
    AND e.data_transacao BETWEEN v_ini AND v_fim
    -- Achado pré-C2-8: o espelho sintético do próprio Getnet não é uma
    -- linha "sem candidato" esperando conciliação manual genérica — ele
    -- nunca vai ter um candidato F4 (não é crédito/débito bancário real),
    -- então sempre apareceria aqui, confundindo o tesoureiro com uma tarefa
    -- que não existe (o vínculo real dele é via Hop1/lote, telas próprias).
    -- Guarda de NULL (achado do code-review): NOT fin_e_espelho_getnet(NULL)
    -- é NULL, não TRUE — sem o `origem IS NULL OR`, um extrato real com
    -- origem NULL sumiria desta lista silenciosamente.
    AND (e.origem IS NULL OR NOT public.fin_e_espelho_getnet(e.origem))
    AND NOT EXISTS (SELECT 1 FROM candidatos ca WHERE ca.extrato_id = e.id)
    -- Confirmado pelo motor Cartão (lote de antecipação) — não marca
    -- reconciliado, então precisa de exclusão explícita (achado C2-1).
    AND NOT EXISTS (
      SELECT 1 FROM public.getnet_antecipacao_lotes gal
       WHERE gal.extrato_bancario_id = e.id
    )
  ORDER BY e.data_transacao DESC;
END;
$$;

COMMENT ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) IS
  'Extratos pendentes que sobraram depois dos motores Cartão (Getnet) e Inteligente (F4) — base do Modo Clássico como estado derivado (Ciclo 2, C2-1). Reaproveita fin_gerar_candidatos_conciliacao como função de tabela; exclui vínculo confirmado em getnet_antecipacao_lotes (não coberto por reconciliado=true) e origem espelho Getnet (achado pré-C2-8 — nunca teria candidato real, confundiria o tesoureiro).';

GRANT EXECUTE ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) FROM anon;

GRANT EXECUTE ON FUNCTION public.fin_gerar_candidatos_conciliacao(uuid, date, date, numeric, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_conciliacao(uuid, date, date, numeric, uuid, jsonb) FROM anon;

-- ─── 3. view_reconciliacao_cobertura — Relatório (§ "Cobertura Geral") ─────
-- Mesmo achado: contava extratos_bancarios sem excluir origem espelho,
-- inflando Total/Reconciliados/Pendentes/% Cobertura/Valor com dados
-- sintéticos do Getnet (não é um movimento bancário real). Plain view
-- (não SECURITY DEFINER) — RLS de extratos_bancarios já se aplica por trás,
-- este fix só remove o espelho da contagem.
CREATE OR REPLACE VIEW public.view_reconciliacao_cobertura AS
SELECT
  e.igreja_id,
  e.filial_id,
  e.conta_id,
  c.nome AS conta_nome,
  DATE_TRUNC('month', e.data_transacao) AS periodo,
  COUNT(*) AS total_extratos,
  COUNT(*) FILTER (WHERE e.reconciliado = TRUE) AS extratos_reconciliados,
  COUNT(*) FILTER (WHERE e.reconciliado = FALSE) AS extratos_pendentes,
  ROUND(
    (COUNT(*) FILTER (WHERE e.reconciliado = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS percentual_cobertura,
  SUM(ABS(e.valor)) AS valor_total,
  SUM(ABS(e.valor)) FILTER (WHERE e.reconciliado = TRUE) AS valor_reconciliado,
  SUM(ABS(e.valor)) FILTER (WHERE e.reconciliado = FALSE) AS valor_pendente
FROM extratos_bancarios e
LEFT JOIN contas c ON c.id = e.conta_id
-- Guarda de NULL (achado do code-review, mesmo padrão acima): sem o
-- `origem IS NULL OR`, um extrato real com origem NULL desaparece
-- silenciosamente das contagens desta view.
WHERE (e.origem IS NULL OR NOT public.fin_e_espelho_getnet(e.origem))
GROUP BY e.igreja_id, e.filial_id, e.conta_id, c.nome, DATE_TRUNC('month', e.data_transacao);

-- ─── 4. fin_confirmar_conciliacao — rejeita na ESCRITA (achado Codex P1) ───
-- O fix acima só protege quem passa pelo motor F4 (candidatos gerados).
-- `useConciliacaoInteligente.ts` (painel "Banco") carrega TODO extrato
-- não reconciliado direto de extratos_bancarios, sem filtrar origem, e
-- deixa o usuário selecionar manualmente + chamar fin_confirmar_
-- conciliacao — que também nunca validava origem. Um usuário podia
-- confirmar manualmente o espelho Getnet como o lado bancário de
-- qualquer transação real, contornando o filtro de candidatos por
-- inteiro. Mesmo padrão da C2-7 (fecha geração E escrita, não só uma).
CREATE OR REPLACE FUNCTION public.fin_confirmar_conciliacao(
  p_vinculo jsonb,
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
  v_extrato_ids uuid[];
  v_transacao_ids uuid[];
  v_tipo_match text;
  v_score numeric := NULLIF(p_vinculo ->> 'score', '')::numeric;
  v_sugestao_id uuid := NULLIF(p_vinculo ->> 'sugestao_id', '')::uuid;
  v_ext record;
  v_trx record;
  v_conta uuid;
  v_data_extrato date;
  v_novo_status text;
  v_lote_id uuid;
  v_divisao_id uuid;
  v_soma_divisao numeric;
  v_id uuid;
  v_warnings text[] := '{}';
  v_filial_efetiva uuid;
  v_tem_filial_compartilhada boolean := false;
  v_filiais_distintas uuid[] := '{}';
  v_div_ids uuid[];
BEGIN
  v_extrato_ids := ARRAY(SELECT jsonb_array_elements_text(p_vinculo -> 'extrato_ids'))::uuid[];
  v_transacao_ids := ARRAY(SELECT jsonb_array_elements_text(p_vinculo -> 'transacao_ids'))::uuid[];

  IF array_length(v_extrato_ids, 1) IS NULL OR array_length(v_transacao_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato_ids e transacao_ids são obrigatórios';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Trava e valida os extratos no tenant (mesma conta para todos).
  -- ORDER BY id: guardrail D.1 (ordem determinística anti-deadlock).
  FOR v_ext IN
    SELECT id, conta_id, valor, data_transacao, reconciliado, igreja_id, filial_id, origem
      FROM public.extratos_bancarios
     WHERE id = ANY(v_extrato_ids)
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_ext.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: extrato % fora do tenant', v_ext.id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_ext.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do extrato %', v_ext.id;
    END IF;
    -- Achado pré-C2-8 (Codex P1, 2ª rodada desta PR): o espelho sintético
    -- do próprio Getnet não é um crédito/débito bancário real. `IF
    -- fin_e_espelho_getnet(NULL) THEN` nunca entra no branch (NULL não é
    -- TRUE em plpgsql) — não precisa de guarda extra aqui, é uma rejeição
    -- (bare), não um filtro de exclusão.
    IF public.fin_e_espelho_getnet(v_ext.origem) THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: extrato % é o espelho sintético do próprio Getnet, não um crédito bancário real', v_ext.id;
    END IF;
    IF v_ext.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_ext.filial_id = ANY(v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_ext.filial_id;
    END IF;
    IF v_ext.reconciliado THEN
      RAISE EXCEPTION 'FIN_CONCILIADO: extrato % já está conciliado', v_ext.id;
    END IF;
    v_conta := COALESCE(v_conta, v_ext.conta_id);
    v_data_extrato := COALESCE(v_data_extrato, v_ext.data_transacao);
  END LOOP;
  IF v_conta IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: nenhum extrato encontrado';
  END IF;

  -- Trava e valida as transações no tenant.
  PERFORM 1;
  FOR v_trx IN
    SELECT id, igreja_id, status, conciliacao_status, transferencia_id, filial_id
      FROM public.transacoes_financeiras
     WHERE id = ANY(v_transacao_ids)
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_trx.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: transação % fora do tenant', v_trx.id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_trx.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da transação %', v_trx.id;
    END IF;
    IF v_trx.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_trx.filial_id = ANY(v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_trx.filial_id;
    END IF;
    IF v_trx.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
      RAISE EXCEPTION 'FIN_CONCILIADO: transação % já está conciliada', v_trx.id;
    END IF;
  END LOOP;

  -- Filial mista: rejeita só quando ≥2 filiais concretas sem âncora
  -- compartilhada (filial_id IS NULL). Espelha o join do motor F4.
  IF coalesce(array_length(v_filiais_distintas, 1), 0) > 1
     AND NOT v_tem_filial_compartilhada THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: itens de filiais diferentes não podem ser conciliados juntos';
  END IF;
  IF coalesce(array_length(v_filiais_distintas, 1), 0) = 1 THEN
    v_filial_efetiva := v_filiais_distintas[1];
  ELSE
    -- tudo compartilhado, ou mix mediado por recurso compartilhado
    v_filial_efetiva := NULL;
  END IF;

  -- Determina o formato pelo cardinalidade.
  IF array_length(v_extrato_ids, 1) = 1 AND array_length(v_transacao_ids, 1) = 1 THEN
    v_tipo_match := '1:1';
  ELSIF array_length(v_transacao_ids, 1) = 1 THEN
    v_tipo_match := 'N:1';   -- vários extratos, uma transação (lote)
  ELSIF array_length(v_extrato_ids, 1) = 1 THEN
    v_tipo_match := '1:N';   -- um extrato, várias transações (divisão)
  ELSE
    RAISE EXCEPTION 'FIN_VALIDACAO: N extratos × N transações não é suportado';
  END IF;

  -- ── Estruturas de vínculo por formato ──
  IF v_tipo_match = '1:1' THEN
    UPDATE public.extratos_bancarios
       SET reconciliado = true, transacao_vinculada_id = v_transacao_ids[1]
     WHERE id = v_extrato_ids[1];

  ELSIF v_tipo_match = 'N:1' THEN
    DECLARE
      v_valor_trx numeric := COALESCE((SELECT valor FROM public.transacoes_financeiras WHERE id = v_transacao_ids[1]), 0);
      v_soma_ext numeric := COALESCE((SELECT SUM(valor) FROM public.extratos_bancarios WHERE id = ANY(v_extrato_ids)), 0);
    BEGIN
      -- diferenca é GENERATED ALWAYS (valor_transacao - valor_extratos): não inserir.
      INSERT INTO public.conciliacoes_lote
        (transacao_id, igreja_id, filial_id, conta_id, valor_transacao, valor_extratos, status, created_by)
      VALUES (v_transacao_ids[1], v_igreja, v_filial_efetiva, v_conta,
              v_valor_trx, v_soma_ext,
              -- preserva a distinção do fluxo antigo: balanceado × discrepância
              CASE WHEN abs(v_soma_ext - v_valor_trx) < 0.01 THEN 'conciliada' ELSE 'discrepancia' END,
              (v_ctx ->> 'ator_user_id')::uuid)
      RETURNING id INTO v_lote_id;

      IF abs(v_soma_ext - v_valor_trx) >= 0.01 THEN
        v_warnings := v_warnings ||
          format('lote com discrepância de %s (extratos %s × transação %s)',
                 to_char(abs(v_soma_ext - v_valor_trx), 'FM999G999G990D00'), v_soma_ext, v_valor_trx);
      END IF;
    END;

    INSERT INTO public.conciliacoes_lote_extratos (conciliacao_lote_id, extrato_id)
    SELECT v_lote_id, unnest(v_extrato_ids);

    UPDATE public.extratos_bancarios
       SET reconciliado = true
     WHERE id = ANY(v_extrato_ids);

  ELSE  -- 1:N (divisão)
    IF NOT (p_vinculo ? 'divisoes') THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: formato 1:N exige divisoes[{transacao_id, valor}]';
    END IF;

    -- Fecha bypass: divisoes e transacao_ids devem ser o MESMO conjunto.
    -- Sem isso, um VICTIM em divisoes (fora do array travado/checado)
    -- entrava em conciliacoes_divisao_transacoes sem HFA/tenant/lock.
    v_div_ids := ARRAY(
      SELECT DISTINCT (d ->> 'transacao_id')::uuid
        FROM jsonb_array_elements(p_vinculo -> 'divisoes') d
       WHERE NULLIF(d ->> 'transacao_id', '') IS NOT NULL
    );
    IF array_length(v_div_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: divisoes vazias ou sem transacao_id';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(v_div_ids) d_id
       WHERE NOT (d_id = ANY(v_transacao_ids))
    ) THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: divisoes.transacao_id fora de transacao_ids';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(v_transacao_ids) t_id
       WHERE NOT (t_id = ANY(v_div_ids))
    ) THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: transacao_ids sem correspondente em divisoes';
    END IF;

    SELECT COALESCE(SUM((d ->> 'valor')::numeric), 0)
      INTO v_soma_divisao
      FROM jsonb_array_elements(p_vinculo -> 'divisoes') d;

    INSERT INTO public.conciliacoes_divisao
      (extrato_id, igreja_id, filial_id, conta_id, valor_extrato, status, created_by)
    VALUES (v_extrato_ids[1], v_igreja, v_filial_efetiva, v_conta,
            (SELECT valor FROM public.extratos_bancarios WHERE id = v_extrato_ids[1]),
            'confirmada', (v_ctx ->> 'ator_user_id')::uuid)
    RETURNING id INTO v_divisao_id;

    INSERT INTO public.conciliacoes_divisao_transacoes (conciliacao_divisao_id, transacao_id, valor)
    SELECT v_divisao_id, (d ->> 'transacao_id')::uuid, (d ->> 'valor')::numeric
      FROM jsonb_array_elements(p_vinculo -> 'divisoes') d;

    UPDATE public.extratos_bancarios
       SET reconciliado = true
     WHERE id = v_extrato_ids[1];
  END IF;

  -- ── Estado das transações: conciliado + baixa (pendente→pago) + irmã ──
  FOR v_trx IN
    SELECT id, status, transferencia_id
      FROM public.transacoes_financeiras
     WHERE id = ANY(v_transacao_ids)
  LOOP
    v_novo_status := CASE WHEN v_trx.status = 'pendente' THEN 'pago' ELSE v_trx.status END;

    UPDATE public.transacoes_financeiras
       SET conciliacao_status = 'conciliado_extrato',
           status = v_novo_status,
           data_pagamento = CASE WHEN v_trx.status = 'pendente' THEN v_data_extrato ELSE data_pagamento END,
           updated_at = now()
     WHERE id = v_trx.id;

    -- Perna irmã da transferência acompanha.
    IF v_trx.transferencia_id IS NOT NULL THEN
      UPDATE public.transacoes_financeiras
         SET conciliacao_status = 'conciliado_extrato',
             status = v_novo_status,
             data_pagamento = CASE WHEN status = 'pendente' THEN v_data_extrato ELSE data_pagamento END,
             updated_at = now()
       WHERE transferencia_id = v_trx.transferencia_id
         AND id <> v_trx.id;
    END IF;
  END LOOP;

  -- ── Auditoria (reconciliacao_audit_logs por par + ML feedback + fin_audit) ──
  -- tipo_reconciliacao restrito ao CHECK (automatica|manual|lote|desconciliacao);
  -- o formato fino (1:1/N:1/1:N) vai em metadata.tipo_match.
  -- filial_id = contexto do ATOR (não v_filial_efetiva): relatório de
  -- cobertura filtra pela filial em que o usuário estava trabalhando.
  INSERT INTO public.reconciliacao_audit_logs
    (extrato_id, transacao_id, conta_id, igreja_id, filial_id, acao,
     tipo_reconciliacao, score, valor_extrato, valor_transacao, diferenca,
     conciliacao_lote_id, usuario_id, metadata)
  SELECT e_id, t_id, v_conta, v_igreja, NULLIF(v_ctx ->> 'filial_id','')::uuid,
         'conciliacao',
         CASE WHEN v_tipo_match = 'N:1' THEN 'lote' ELSE 'manual' END,
         v_score,
         (SELECT valor FROM public.extratos_bancarios WHERE id = e_id),
         (SELECT valor FROM public.transacoes_financeiras WHERE id = t_id),
         NULL, v_lote_id, NULLIF(v_ctx ->> 'ator_profile_id','')::uuid,
         jsonb_build_object('tipo_match', v_tipo_match, 'canal', v_ctx ->> 'canal')
    FROM unnest(v_extrato_ids) e_id
    CROSS JOIN unnest(v_transacao_ids) t_id;

  IF NULLIF(v_ctx ->> 'ator_profile_id','') IS NOT NULL THEN
    INSERT INTO public.conciliacao_ml_feedback
      (igreja_id, filial_id, conta_id, tipo_match, extrato_ids, transacao_ids,
       acao, score, modelo_versao, usuario_id, sugestao_id, ajustes)
    VALUES (v_igreja, NULLIF(v_ctx ->> 'filial_id','')::uuid, v_conta, v_tipo_match,
            v_extrato_ids, v_transacao_ids, 'ajustada', COALESCE(v_score, 1.0), 'v1',
            (v_ctx ->> 'ator_profile_id')::uuid, v_sugestao_id,
            jsonb_build_object('via', 'fin_confirmar_conciliacao'));
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_confirmar_conciliacao', 'extratos_bancarios', v_extrato_ids[1],
    p_vinculo,
    jsonb_build_object('tipo_match', v_tipo_match,
                       'extrato_ids', to_jsonb(v_extrato_ids),
                       'transacao_ids', to_jsonb(v_transacao_ids)));

  RETURN jsonb_build_object('ok', true, 'tipo_match', v_tipo_match,
                            'extrato_ids', to_jsonb(v_extrato_ids),
                            'transacao_ids', to_jsonb(v_transacao_ids),
                            'warnings', to_jsonb(v_warnings));
END;
$$;

COMMENT ON FUNCTION public.fin_confirmar_conciliacao(jsonb, jsonb) IS
  'Porta única de confirmação de conciliação (1:1/N:1/1:N). has_filial_access por item; filial mista só com âncora compartilhada (alinhado ao motor F4); divisoes ≡ transacao_ids; locks ORDER BY id; lote/divisão usam v_filial_efetiva; audit/ML usam filial do contexto. Rejeita extrato com origem espelho Getnet (achado pré-C2-8, fin_e_espelho_getnet) — a boundary real de escrita, não só o filtro de candidatos do motor F4.';
