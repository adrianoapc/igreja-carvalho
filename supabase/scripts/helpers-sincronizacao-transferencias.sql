-- =============================================
-- FUNÇÃO AUXILIAR: CONTAR TRANSFERÊNCIAS DESSINCRONIZADAS
-- =============================================
-- 
-- Esta função retorna a quantidade de transferências onde
-- a ENTRADA foi conciliada mas a SAÍDA não.
--

CREATE OR REPLACE FUNCTION public.contar_transferencias_dessincronizadas(
  p_igreja_id UUID,
  p_filial_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM transferencias_contas tc
  INNER JOIN transacoes_financeiras tce 
    ON tce.transferencia_id = tc.id AND tce.tipo = 'entrada'
  INNER JOIN transacoes_financeiras tcs 
    ON tcs.transferencia_id = tc.id AND tcs.tipo = 'saida'
  WHERE tc.igreja_id = p_igreja_id
    AND (p_filial_id IS NULL OR tc.filial_id = p_filial_id)
    AND tce.conciliacao_status IN ('conciliado_extrato', 'conciliado_manual', 'conciliado_bot', 'conferido_manual')
    AND tcs.conciliacao_status IS DISTINCT FROM tce.conciliacao_status;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- =============================================
-- FUNÇÃO AUXILIAR: LISTAR TRANSFERÊNCIAS DESSINCRONIZADAS
-- =============================================
--
-- Retorna detalhes das transferências que precisam sincronização
--

CREATE OR REPLACE FUNCTION public.listar_transferencias_dessincronizadas(
  p_igreja_id UUID,
  p_filial_id UUID DEFAULT NULL,
  p_limite INTEGER DEFAULT 50
)
RETURNS TABLE (
  transferencia_id UUID,
  entrada_id UUID,
  entrada_status TEXT,
  saida_id UUID,
  saida_status TEXT,
  descricao TEXT,
  valor NUMERIC,
  data_transferencia DATE,
  dias_pendente INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.id,
    tce.id,
    tce.conciliacao_status,
    tcs.id,
    tcs.conciliacao_status,
    tce.descricao,
    tc.valor,
    tc.data_transferencia,
    CAST(CURRENT_DATE - tc.data_transferencia AS INTEGER)
  FROM transferencias_contas tc
  INNER JOIN transacoes_financeiras tce 
    ON tce.transferencia_id = tc.id AND tce.tipo = 'entrada'
  INNER JOIN transacoes_financeiras tcs 
    ON tcs.transferencia_id = tc.id AND tcs.tipo = 'saida'
  WHERE tc.igreja_id = p_igreja_id
    AND (p_filial_id IS NULL OR tc.filial_id = p_filial_id)
    AND tce.conciliacao_status IN ('conciliado_extrato', 'conciliado_manual', 'conciliado_bot', 'conferido_manual')
    AND tcs.conciliacao_status IS DISTINCT FROM tce.conciliacao_status
  ORDER BY tc.data_transferencia DESC
  LIMIT p_limite;
END;
$$;

-- =============================================
-- FUNÇÃO AUXILIAR: ESTATÍSTICAS DE SINCRONIZAÇÃO
-- =============================================
--
-- Retorna estatísticas sobre sincronizações realizadas
--

CREATE OR REPLACE FUNCTION public.estatisticas_sincronizacao(
  p_igreja_id UUID,
  p_dias INTEGER DEFAULT 30
)
RETURNS TABLE (
  data DATE,
  transacoes_sincronizadas INTEGER,
  usuarios_envolvidos INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(ac.created_at)::DATE,
    COUNT(*)::INTEGER,
    COUNT(DISTINCT ac.usuario_id)::INTEGER
  FROM auditoria_conciliacoes ac
  WHERE ac.tipo_reconciliacao = 'sincronizacao_transferencia'
    AND ac.igreja_id = p_igreja_id
    AND ac.created_at >= NOW() - INTERVAL '1 day' * p_dias
  GROUP BY DATE(ac.created_at)
  ORDER BY DATE(ac.created_at) DESC;
END;
$$;

-- =============================================
-- FUNÇÃO AUXILIAR: VALIDAÇÃO DE INTEGRIDADE
-- =============================================
--
-- Valida a integridade das transferências
-- Retorna problemas encontrados
--

CREATE OR REPLACE FUNCTION public.validar_integridade_transferencias(
  p_igreja_id UUID
)
RETURNS TABLE (
  problema_tipo TEXT,
  quantidade INTEGER,
  exemplo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Problema 1: Transferência sem transação de entrada
  RETURN QUERY
  SELECT 
    'Transferência sem ENTRADA'::TEXT,
    COUNT(*)::INTEGER,
    MAX(tc.id)::TEXT
  FROM transferencias_contas tc
  WHERE tc.igreja_id = p_igreja_id
    AND NOT EXISTS (
      SELECT 1 FROM transacoes_financeiras t
      WHERE t.transferencia_id = tc.id AND t.tipo = 'entrada'
    )
  GROUP BY 'Transferência sem ENTRADA';

  -- Problema 2: Transferência sem transação de saída
  RETURN QUERY
  SELECT 
    'Transferência sem SAÍDA'::TEXT,
    COUNT(*)::INTEGER,
    MAX(tc.id)::TEXT
  FROM transferencias_contas tc
  WHERE tc.igreja_id = p_igreja_id
    AND NOT EXISTS (
      SELECT 1 FROM transacoes_financeiras t
      WHERE t.transferencia_id = tc.id AND t.tipo = 'saida'
    )
  GROUP BY 'Transferência sem SAÍDA';

  -- Problema 3: Entrada e saída com valores diferentes
  RETURN QUERY
  SELECT 
    'ENTRADA e SAÍDA com valores diferentes'::TEXT,
    COUNT(*)::INTEGER,
    MAX(tc.id)::TEXT
  FROM transferencias_contas tc
  INNER JOIN transacoes_financeiras tce 
    ON tce.transferencia_id = tc.id AND tce.tipo = 'entrada'
  INNER JOIN transacoes_financeiras tcs 
    ON tcs.transferencia_id = tc.id AND tcs.tipo = 'saida'
  WHERE tc.igreja_id = p_igreja_id
    AND tce.valor != tcs.valor
  GROUP BY 'ENTRADA e SAÍDA com valores diferentes';
END;
$$;
