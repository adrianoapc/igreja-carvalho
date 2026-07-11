-- ============================================================================
-- F2.5 — Leitura agregada no servidor (modelo get_dre_anual)
--
-- Elimina o truncamento silencioso de 1000 linhas do PostgREST e a agregação
-- client-side dos dashboards:
--   · fin_resumo_periodo   — totais por tipo×status (Dashboard)
--   · fin_ofertas_periodo  — ofertas por dia×forma×conta com FILTRO
--     ESTRUTURAL (sessao_id ou categoria de oferta) no lugar do frágil
--     ilike(descricao, '%oferta%')
--   · fin_projecao_mensal  — realizado (data_pagamento) × previsto
--     (data_vencimento) por mês (Projeções)
--   · get_dre_anual ganha p_regime ('caixa' default | 'competencia')
--
-- Todas SECURITY DEFINER com tenant via JWT (get_current_user_igreja_id) —
-- mesmo padrão de get_dre_anual. Leitura apenas; sem p_contexto.
-- ============================================================================

-- ─── 1. fin_resumo_periodo ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_resumo_periodo(
  p_inicio date,
  p_fim date,
  p_filial_id uuid DEFAULT NULL
)
RETURNS TABLE(tipo text, status text, total numeric, quantidade bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_igreja uuid := public.get_current_user_igreja_id();
BEGIN
  IF v_igreja IS NULL THEN
    RAISE EXCEPTION 'FIN_TENANT: igreja não resolvida a partir do JWT';
  END IF;

  RETURN QUERY
  SELECT t.tipo, t.status,
         COALESCE(SUM(t.valor), 0) AS total,
         COUNT(*) AS quantidade
    FROM public.transacoes_financeiras t
    LEFT JOIN public.solicitacoes_reembolso sr ON sr.id = t.solicitacao_reembolso_id
   WHERE t.igreja_id = v_igreja
     AND t.data_vencimento BETWEEN p_inicio AND p_fim
     AND (p_filial_id IS NULL OR t.filial_id = p_filial_id)
     AND t.status <> 'cancelado'
     AND (t.solicitacao_reembolso_id IS NULL OR sr.status = 'pago')
   GROUP BY t.tipo, t.status;
END;
$$;

-- ─── 2. fin_ofertas_periodo ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_ofertas_periodo(
  p_inicio date,
  p_fim date,
  p_filial_id uuid DEFAULT NULL
)
RETURNS TABLE(
  dia date,
  forma_pagamento_id text,
  forma_nome text,
  conta_nome text,
  total numeric,
  quantidade bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_igreja uuid := public.get_current_user_igreja_id();
BEGIN
  IF v_igreja IS NULL THEN
    RAISE EXCEPTION 'FIN_TENANT: igreja não resolvida a partir do JWT';
  END IF;

  RETURN QUERY
  SELECT t.data_vencimento AS dia,
         t.forma_pagamento AS forma_pagamento_id,
         COALESCE(fp.nome, 'Não especificado') AS forma_nome,
         COALESCE(c.nome, 'Sem conta') AS conta_nome,
         COALESCE(SUM(t.valor), 0) AS total,
         COUNT(*) AS quantidade
    FROM public.transacoes_financeiras t
    LEFT JOIN public.formas_pagamento fp ON fp.id::text = t.forma_pagamento
    LEFT JOIN public.contas c ON c.id = t.conta_id
    LEFT JOIN public.categorias_financeiras cat ON cat.id = t.categoria_id
   WHERE t.igreja_id = v_igreja
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.data_vencimento BETWEEN p_inicio AND p_fim
     AND (p_filial_id IS NULL OR t.filial_id = p_filial_id)
     -- Filtro ESTRUTURAL: sessão de contagem ou categoria de oferta/dízimo
     -- (substitui ilike em descricao, que dependia de texto livre)
     AND (
       t.sessao_id IS NOT NULL
       OR cat.nome ILIKE '%oferta%'
       OR cat.nome ILIKE '%d_zimo%'
     )
   GROUP BY t.data_vencimento, t.forma_pagamento, fp.nome, c.nome
   ORDER BY t.data_vencimento;
END;
$$;

-- ─── 3. fin_projecao_mensal ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_projecao_mensal(
  p_meses_historico int DEFAULT 6,
  p_meses_futuro int DEFAULT 6,
  p_filial_id uuid DEFAULT NULL
)
RETURNS TABLE(mes date, tipo text, realizado numeric, previsto numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_igreja uuid := public.get_current_user_igreja_id();
  v_inicio date := date_trunc('month', CURRENT_DATE)::date
                   - make_interval(months => p_meses_historico);
  v_fim date := date_trunc('month', CURRENT_DATE)::date
                + make_interval(months => p_meses_futuro + 1) - interval '1 day';
BEGIN
  IF v_igreja IS NULL THEN
    RAISE EXCEPTION 'FIN_TENANT: igreja não resolvida a partir do JWT';
  END IF;

  RETURN QUERY
  WITH realizado AS (
    SELECT date_trunc('month', t.data_pagamento)::date AS m, t.tipo AS tp,
           SUM(t.valor) AS v
      FROM public.transacoes_financeiras t
     WHERE t.igreja_id = v_igreja
       AND t.status = 'pago'
       AND t.data_pagamento BETWEEN v_inicio AND v_fim
       AND (p_filial_id IS NULL OR t.filial_id = p_filial_id)
     GROUP BY 1, 2
  ),
  previsto AS (
    SELECT date_trunc('month', t.data_vencimento)::date AS m, t.tipo AS tp,
           SUM(t.valor) AS v
      FROM public.transacoes_financeiras t
     WHERE t.igreja_id = v_igreja
       AND t.status = 'pendente'
       AND t.data_vencimento BETWEEN v_inicio AND v_fim
       AND (p_filial_id IS NULL OR t.filial_id = p_filial_id)
     GROUP BY 1, 2
  )
  SELECT COALESCE(r.m, p.m) AS mes,
         COALESCE(r.tp, p.tp) AS tipo,
         COALESCE(r.v, 0) AS realizado,
         COALESCE(p.v, 0) AS previsto
    FROM realizado r
    FULL OUTER JOIN previsto p ON p.m = r.m AND p.tp = r.tp
   ORDER BY 1, 2;
END;
$$;

-- ─── 4. get_dre_anual com regime parametrizado ─────────────────────────────
-- caixa (default): comportamento atual — apenas status='pago'.
-- competencia: inclui pendentes (exclui cancelados) — ADR-001 aponta
-- data_competencia como eixo; o filtro de reembolso não pago é mantido.
-- DROP evita sobrecarga ambígua com a versão de 1 parâmetro.

DROP FUNCTION IF EXISTS public.get_dre_anual(integer);

CREATE OR REPLACE FUNCTION public.get_dre_anual(
  p_ano integer,
  p_regime text DEFAULT 'caixa'
)
RETURNS TABLE(secao_dre text, categoria_nome text, categoria_id uuid, mes integer, total numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_igreja_id uuid;
BEGIN
  IF p_regime NOT IN ('caixa', 'competencia') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: regime deve ser caixa|competencia';
  END IF;

  v_igreja_id := public.get_jwt_igreja_id();

  RETURN QUERY
  SELECT
    c.secao_dre,
    c.nome as categoria_nome,
    c.id as categoria_id,
    EXTRACT(MONTH FROM t.data_competencia)::INTEGER as mes,
    SUM(
      CASE
        WHEN t.tipo = 'saida' THEN -t.valor
        ELSE t.valor
      END
    ) as total
  FROM public.transacoes_financeiras t
  JOIN public.categorias_financeiras c ON c.id = t.categoria_id
  LEFT JOIN public.solicitacoes_reembolso sr ON sr.id = t.solicitacao_reembolso_id
  WHERE
    EXTRACT(YEAR FROM t.data_competencia) = p_ano
    AND (
      (p_regime = 'caixa' AND t.status = 'pago')
      OR (p_regime = 'competencia' AND t.status <> 'cancelado')
    )
    AND (v_igreja_id IS NULL OR t.igreja_id = v_igreja_id)
    AND (t.solicitacao_reembolso_id IS NULL OR sr.status = 'pago')
  GROUP BY
    c.secao_dre,
    c.nome,
    c.id,
    EXTRACT(MONTH FROM t.data_competencia)
  ORDER BY
    c.secao_dre DESC,
    c.nome;
END;
$function$;

-- ─── 5. Grants ──────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.fin_resumo_periodo(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fin_ofertas_periodo(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fin_projecao_mensal(int, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dre_anual(integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.fin_resumo_periodo(date, date, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fin_ofertas_periodo(date, date, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fin_projecao_mensal(int, int, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_dre_anual(integer, text) FROM anon;
