CREATE OR REPLACE FUNCTION public.rejeitar_sugestao_conciliacao(
  p_sugestao_id UUID,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sugestao RECORD;
  v_valid_usuario_id UUID;
  v_sugestoes_relacionadas UUID[];
  v_affected_count INT;
BEGIN
  -- Buscar sugestão principal
  SELECT * INTO v_sugestao
  FROM conciliacao_ml_sugestoes
  WHERE id = p_sugestao_id AND status = 'pendente';

  IF v_sugestao IS NULL THEN
    RAISE EXCEPTION 'Sugestão não encontrada ou já processada';
  END IF;

  -- Validar que usuario_id existe em profiles (se fornecido)
  IF p_usuario_id IS NOT NULL THEN
    SELECT id INTO v_valid_usuario_id
    FROM profiles
    WHERE id = p_usuario_id;
  END IF;

  -- Buscar TODAS as sugestões que envolvem os mesmos extratos E transações
  SELECT ARRAY_AGG(id) INTO v_sugestoes_relacionadas
  FROM conciliacao_ml_sugestoes
  WHERE status = 'pendente'
    AND igreja_id = v_sugestao.igreja_id
    AND extrato_ids = v_sugestao.extrato_ids
    AND transacao_ids = v_sugestao.transacao_ids;

  -- Atualizar status de TODAS as sugestões relacionadas para rejeitada
  UPDATE conciliacao_ml_sugestoes
  SET status = 'rejeitada', updated_at = now()
  WHERE id = ANY(v_sugestoes_relacionadas);

  GET DIAGNOSTICS v_affected_count = ROW_COUNT;

  -- Inserir feedback de rejeição apenas para a sugestão principal
  INSERT INTO conciliacao_ml_feedback (
    sugestao_id, igreja_id, filial_id, conta_id, tipo_match,
    extrato_ids, transacao_ids, acao, score, modelo_versao, usuario_id, ajustes
  ) VALUES (
    p_sugestao_id, v_sugestao.igreja_id, v_sugestao.filial_id, v_sugestao.conta_id,
    v_sugestao.tipo_match, v_sugestao.extrato_ids, v_sugestao.transacao_ids,
    'rejeitada', v_sugestao.score, v_sugestao.modelo_versao, v_valid_usuario_id,
    jsonb_build_object('sugestoes_rejeitadas_em_batch', v_affected_count)
  );

  RAISE NOTICE 'Rejeitadas % sugestões relacionadas', v_affected_count;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.rejeitar_sugestao_conciliacao IS 
'Rejeita uma sugestão e todas as sugestões relacionadas (mesmos extratos ou transações) para evitar re-sugestão.';