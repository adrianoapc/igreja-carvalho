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
