-- ============================================================================
-- F4 — Motor único de score de conciliação (ADR-030)
--
-- Elege `gerar_candidatos_conciliacao` (score contínuo 0..1, formatos 1:1 e
-- 1:N) como o ÚNICO motor de candidatos e o porta para o padrão canônico
-- `fin_*` (ADR-029): `fin_gerar_candidatos_conciliacao`. Passam a ser
-- deprecados os dois caminhos concorrentes:
--   · RPC legada `reconciliar_transacoes` (score inteiro 50-100, só 1:1,
--     faixas discretas) — usada por ConciliacaoManual/DashboardConciliacao;
--   · score client-side heurístico de ConciliacaoInteligente.tsx.
-- A aplicação legada `aplicar_conciliacao` (1:1, sem baixa pendente→pago, sem
-- irmã de transferência) é substituída no frontend por `fin_confirmar_conciliacao`
-- (F3). As três — reconciliar_transacoes, aplicar_conciliacao e o motor
-- público antigo — ficam DEPRECADAS (comentário), sem DROP: a remoção física
-- fica para a F7 (endurecimento), depois de garantir que nenhum canal fora do
-- frontend as chama.
--
-- Diferenças da versão canônica frente à pública:
--   · tenant/ator resolvidos por `fin_resolver_contexto` (guarda admin|tesoureiro
--     no JWT; service role via p_contexto validado) — a igreja NÃO vem mais como
--     parâmetro confiável (p_igreja_id era aceito cru pela pública, SECURITY
--     DEFINER, sem checar quem chama);
--   · `p_score_minimo` resolve por chamada → `financeiro_config.conciliacao_score_minimo`
--     (novo, por igreja/filial) → default 0.6 — o corte passa a ser
--     parametrizável por igreja (ADR-030 §8.1);
--   · a fórmula de pesos (0.4 valor / 0.3 data / 0.2 descrição / 0.1 tipo) é
--     preservada intacta (motor provado em produção).
--
-- Depende de F1 (fin_resolver_contexto) e das tabelas de conciliação.
-- ============================================================================

-- ─── 1. Corte de score parametrizável por igreja/filial ─────────────────────
ALTER TABLE public.financeiro_config
  ADD COLUMN IF NOT EXISTS conciliacao_score_minimo numeric(5,4);

COMMENT ON COLUMN public.financeiro_config.conciliacao_score_minimo IS
  'Corte mínimo (0..1) do motor único de candidatos (fin_gerar_candidatos_conciliacao). NULL = default 0.6.';

-- ─── 2. fin_gerar_candidatos_conciliacao — motor único (ADR-030) ────────────
-- Retorna candidatos ranqueados; NÃO grava (a persistência em
-- conciliacao_ml_sugestoes segue a cargo da edge gerar-sugestoes-ml). A
-- confirmação é sempre via fin_confirmar_conciliacao (F3).

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
    IF NOT public.has_filial_access(v_igreja, p_filial_id) THEN
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
  'Motor ÚNICO de candidatos de conciliação (ADR-030 F4). Score 0..1 (valor 0.4/data 0.3/descrição 0.2/tipo 0.1), formatos 1:1 e 1:N. Tenant/ator via fin_resolver_contexto; corte por igreja em financeiro_config.conciliacao_score_minimo. Confirmação via fin_confirmar_conciliacao.';

-- ─── 3. Deprecação dos motores/aplicadores legados (sem DROP — F7) ──────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reconciliar_transacoes') THEN
    EXECUTE $c$COMMENT ON FUNCTION public.reconciliar_transacoes(uuid, numeric, integer) IS
      'DEPRECADA (ADR-030 F4): substituída por fin_gerar_candidatos_conciliacao (motor único, score 0..1). Sem call-site no frontend desde a F4. DROP planejado para a F7.';$c$;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'aplicar_conciliacao') THEN
    EXECUTE $c$COMMENT ON FUNCTION public.aplicar_conciliacao(uuid, uuid, text, integer, uuid) IS
      'DEPRECADA (ADR-030 F4): substituída por fin_confirmar_conciliacao (F3, transacional, baixa pendente→pago + irmã de transferência). DROP planejado para a F7.';$c$;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gerar_candidatos_conciliacao') THEN
    EXECUTE $c$COMMENT ON FUNCTION public.gerar_candidatos_conciliacao(uuid, uuid, date, date, numeric) IS
      'DEPRECADA (ADR-030 F4): use fin_gerar_candidatos_conciliacao (resolve tenant/ator e corte por igreja). Mantida enquanto a edge gerar-sugestoes-ml não migrar. DROP planejado para a F7.';$c$;
  END IF;
END $$;

-- ─── 4. Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fin_gerar_candidatos_conciliacao(uuid, date, date, numeric, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_conciliacao(uuid, date, date, numeric, uuid, jsonb) FROM anon;
