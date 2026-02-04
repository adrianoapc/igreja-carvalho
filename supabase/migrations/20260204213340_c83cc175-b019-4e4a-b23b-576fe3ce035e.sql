-- Função para rejeitar uma sugestão de conciliação
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
BEGIN
  -- Buscar sugestão
  SELECT * INTO v_sugestao
  FROM conciliacao_ml_sugestoes
  WHERE id = p_sugestao_id AND status = 'pendente';

  IF v_sugestao IS NULL THEN
    RAISE EXCEPTION 'Sugestão não encontrada ou já processada';
  END IF;

  -- Atualizar status da sugestão para rejeitada
  UPDATE conciliacao_ml_sugestoes
  SET status = 'rejeitada', updated_at = now()
  WHERE id = p_sugestao_id;

  -- Inserir feedback de rejeição
  INSERT INTO conciliacao_ml_feedback (
    sugestao_id, igreja_id, filial_id, conta_id, tipo_match,
    extrato_ids, transacao_ids, acao, score, modelo_versao, usuario_id
  ) VALUES (
    p_sugestao_id, v_sugestao.igreja_id, v_sugestao.filial_id, v_sugestao.conta_id,
    v_sugestao.tipo_match, v_sugestao.extrato_ids, v_sugestao.transacao_ids,
    'rejeitada', v_sugestao.score, v_sugestao.modelo_versao, p_usuario_id
  );

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.rejeitar_sugestao_conciliacao IS 
'Rejeita uma sugestão de conciliação e registra feedback para treinamento do modelo.';