-- Função para gerar o DRE anual
CREATE OR REPLACE FUNCTION public.get_dre_anual(p_ano INTEGER)
RETURNS TABLE (
  secao_dre TEXT,
  categoria_nome TEXT,
  categoria_id UUID,
  mes INTEGER,
  total NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  WHERE 
    EXTRACT(YEAR FROM t.data_competencia) = p_ano
    AND t.status = 'pago'
  GROUP BY 
    c.secao_dre,
    c.nome,
    c.id,
    EXTRACT(MONTH FROM t.data_competencia)
  ORDER BY 
    c.secao_dre DESC,
    c.nome;
END;
$$;