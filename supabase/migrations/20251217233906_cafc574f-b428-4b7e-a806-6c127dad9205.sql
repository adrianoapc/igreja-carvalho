-- Atualiza a função get_dre_anual para excluir transações de reembolso que NÃO estão pagas
CREATE OR REPLACE FUNCTION public.get_dre_anual(p_ano integer)
 RETURNS TABLE(secao_dre text, categoria_nome text, categoria_id uuid, mes integer, total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
    AND t.status = 'pago'
    -- Exclui transações de reembolso que NÃO estão pagas
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