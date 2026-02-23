
CREATE OR REPLACE FUNCTION public.desconciliar_transacao(p_transacao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_extratos_1a1 INT := 0;
  v_extratos_lote INT := 0;
  v_extratos_divisao INT := 0;
  v_lotes_removidos INT := 0;
  v_divisoes_removidas INT := 0;
  v_transacao RECORD;
  v_igreja_id UUID;
  v_filial_id UUID;
BEGIN
  -- Buscar dados da transação
  SELECT id, igreja_id, filial_id, conciliacao_status
  INTO v_transacao
  FROM transacoes_financeiras
  WHERE id = p_transacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada: %', p_transacao_id;
  END IF;

  v_igreja_id := v_transacao.igreja_id;
  v_filial_id := v_transacao.filial_id;

  -- 1. Resetar extratos vinculados 1:1
  UPDATE extratos_bancarios
  SET reconciliado = false, transacao_vinculada_id = NULL
  WHERE transacao_vinculada_id = p_transacao_id;
  GET DIAGNOSTICS v_extratos_1a1 = ROW_COUNT;

  -- 2. Resetar extratos vinculados via lote (N:1)
  WITH lotes AS (
    SELECT id FROM conciliacoes_lote WHERE transacao_id = p_transacao_id
  ),
  extratos_lote AS (
    UPDATE extratos_bancarios e
    SET reconciliado = false
    FROM conciliacoes_lote_extratos cle
    JOIN lotes l ON l.id = cle.conciliacao_lote_id
    WHERE e.id = cle.extrato_id
    RETURNING e.id
  )
  SELECT COUNT(*) INTO v_extratos_lote FROM extratos_lote;

  -- Remover registros de lote_extratos
  DELETE FROM conciliacoes_lote_extratos
  WHERE conciliacao_lote_id IN (
    SELECT id FROM conciliacoes_lote WHERE transacao_id = p_transacao_id
  );

  -- Remover lotes
  DELETE FROM conciliacoes_lote WHERE transacao_id = p_transacao_id;
  GET DIAGNOSTICS v_lotes_removidos = ROW_COUNT;

  -- 3. Resetar extratos vinculados via divisão (1:N)
  WITH divisoes AS (
    SELECT id FROM conciliacoes_divisao WHERE extrato_id IN (
      SELECT id FROM extratos_bancarios WHERE transacao_vinculada_id = p_transacao_id
    )
    UNION
    SELECT cd.id FROM conciliacoes_divisao cd
    JOIN conciliacoes_divisao_transacoes cdt ON cdt.conciliacao_divisao_id = cd.id
    WHERE cdt.transacao_id = p_transacao_id
  ),
  transacoes_divisao AS (
    UPDATE transacoes_financeiras tf
    SET conciliacao_status = 'nao_conciliado'
    FROM conciliacoes_divisao_transacoes cdt
    JOIN divisoes d ON d.id = cdt.conciliacao_divisao_id
    WHERE tf.id = cdt.transacao_id AND tf.id != p_transacao_id
    RETURNING tf.id
  ),
  extratos_divisao AS (
    UPDATE extratos_bancarios e
    SET reconciliado = false, transacao_vinculada_id = NULL
    FROM conciliacoes_divisao cd
    JOIN divisoes d ON d.id = cd.id
    WHERE e.id = cd.extrato_id
    RETURNING e.id
  )
  SELECT COUNT(*) INTO v_extratos_divisao FROM extratos_divisao;

  -- Remover registros de divisão_transacoes
  DELETE FROM conciliacoes_divisao_transacoes
  WHERE conciliacao_divisao_id IN (
    SELECT cd.id FROM conciliacoes_divisao cd
    JOIN conciliacoes_divisao_transacoes cdt ON cdt.conciliacao_divisao_id = cd.id
    WHERE cdt.transacao_id = p_transacao_id
    UNION
    SELECT id FROM conciliacoes_divisao WHERE extrato_id IN (
      SELECT id FROM extratos_bancarios WHERE transacao_vinculada_id = p_transacao_id
    )
  );

  -- Remover divisões
  WITH deleted AS (
    DELETE FROM conciliacoes_divisao
    WHERE id IN (
      SELECT cd.id FROM conciliacoes_divisao cd
      JOIN conciliacoes_divisao_transacoes cdt ON cdt.conciliacao_divisao_id = cd.id
      WHERE cdt.transacao_id = p_transacao_id
    )
    OR extrato_id IN (
      SELECT id FROM extratos_bancarios WHERE transacao_vinculada_id = p_transacao_id
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_divisoes_removidas FROM deleted;

  -- 4. Resetar a transação
  UPDATE transacoes_financeiras
  SET conciliacao_status = 'nao_conciliado', conferido_manual = false
  WHERE id = p_transacao_id;

  -- 5. Registrar auditoria
  INSERT INTO reconciliacao_audit_logs (
    transacao_id, extrato_id, acao, tipo_reconciliacao, igreja_id, filial_id, metadata
  ) VALUES (
    p_transacao_id, NULL, 'desconciliacao', 'desconciliacao', v_igreja_id, v_filial_id,
    jsonb_build_object(
      'extratos_1a1', v_extratos_1a1,
      'extratos_lote', v_extratos_lote,
      'extratos_divisao', v_extratos_divisao,
      'lotes_removidos', v_lotes_removidos,
      'divisoes_removidas', v_divisoes_removidas
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'extratos_1a1', v_extratos_1a1,
    'extratos_lote', v_extratos_lote,
    'extratos_divisao', v_extratos_divisao,
    'lotes_removidos', v_lotes_removidos,
    'divisoes_removidas', v_divisoes_removidas
  );
END;
$$;
