-- Corrige get_dre_anual: o regime hoje só filtra `status` (caixa=pago,
-- competencia=tudo exceto cancelado), mas SEMPRE agrupa/filtra ano por
-- data_competencia, independente do regime escolhido. Isso quebra o
-- conceito de "Regime de Caixa": um lançamento pago em julho mas com
-- competência em maio aparecia em maio no DRE de caixa, quando deveria
-- aparecer em julho (mês em que o dinheiro efetivamente moveu).
--
-- caixa       → agrupa por data_pagamento (mês em que o caixa mudou)
-- competencia → agrupa por data_competencia (mês do fato gerador, ADR-001)
--
-- Suposição: status='pago' sempre tem data_pagamento preenchido (setado no
-- fluxo de conciliação/baixa). Se algum dado histórico tiver status='pago'
-- e data_pagamento NULL, essas linhas somem do DRE de caixa — validar com
-- a query abaixo antes de aplicar em produção:
--
--   select count(*) from transacoes_financeiras
--    where status = 'pago' and data_pagamento is null;

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

  IF NOT (has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'tesoureiro'::app_role)) THEN
    RAISE EXCEPTION 'FIN_SEM_PERMISSAO: requer papel admin ou tesoureiro';
  END IF;

  v_igreja_id := public.get_jwt_igreja_id();

  RETURN QUERY
  SELECT
    c.secao_dre,
    c.nome as categoria_nome,
    c.id as categoria_id,
    EXTRACT(MONTH FROM
      CASE WHEN p_regime = 'caixa' THEN t.data_pagamento ELSE t.data_competencia END
    )::INTEGER as mes,
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
    EXTRACT(YEAR FROM
      CASE WHEN p_regime = 'caixa' THEN t.data_pagamento ELSE t.data_competencia END
    ) = p_ano
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
    EXTRACT(MONTH FROM
      CASE WHEN p_regime = 'caixa' THEN t.data_pagamento ELSE t.data_competencia END
    )
  ORDER BY
    c.secao_dre DESC,
    c.nome;
END;
$function$;
