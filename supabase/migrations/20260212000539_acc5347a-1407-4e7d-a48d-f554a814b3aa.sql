-- RPC para relatório de duplicidade de pessoas (contadores simples)
CREATE OR REPLACE FUNCTION public.relatorio_duplicidade_pessoas()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_build_object(
    'total_pendentes', COALESCE(SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END), 0),
    'total_revisados', COALESCE(SUM(CASE WHEN status = 'revisado' THEN 1 ELSE 0 END), 0),
    'total_descartados', COALESCE(SUM(CASE WHEN status = 'descartado' THEN 1 ELSE 0 END), 0),
    'total_geral', COUNT(*),
    'total_mesclagens', (SELECT COUNT(*) FROM pessoas_mesclagens_historico),
    'ultima_verificacao', NOW()
  )
  INTO resultado
  FROM pessoas_duplicatas_suspeitas;

  RETURN resultado;
END;
$$;

-- Permissão para authenticated users chamarem
GRANT EXECUTE ON FUNCTION public.relatorio_duplicidade_pessoas() TO authenticated;
