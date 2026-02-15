
CREATE OR REPLACE FUNCTION public.verificar_integridade_extrato(p_extrato_id UUID)
RETURNS TABLE (
  status TEXT,
  mensagem TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_extrato RECORD;
  v_tem_vinculo_1_1 BOOLEAN;
  v_tem_vinculo_lote BOOLEAN;
BEGIN
  SELECT * INTO v_extrato
  FROM extratos_bancarios
  WHERE id = p_extrato_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'ERRO'::TEXT, 'Extrato não encontrado'::TEXT;
    RETURN;
  END IF;

  v_tem_vinculo_1_1 := v_extrato.transacao_vinculada_id IS NOT NULL;
  v_tem_vinculo_lote := EXISTS (
    SELECT 1 FROM conciliacoes_lote_extratos WHERE extrato_id = p_extrato_id
  );

  IF v_extrato.reconciliado AND NOT v_tem_vinculo_1_1 AND NOT v_tem_vinculo_lote THEN
    RETURN QUERY SELECT 'ÓRFÃO'::TEXT, 
      'Extrato marcado como reconciliado mas sem vínculos - possível erro de conciliação'::TEXT;
  ELSIF v_extrato.reconciliado AND (v_tem_vinculo_1_1 OR v_tem_vinculo_lote) THEN
    RETURN QUERY SELECT 'OK'::TEXT, 
      'Extrato corretamente reconciliado com vínculo ' || 
      CASE WHEN v_tem_vinculo_1_1 THEN '1:1' ELSE 'em lote' END;
  ELSIF NOT v_extrato.reconciliado AND (v_tem_vinculo_1_1 OR v_tem_vinculo_lote) THEN
    RETURN QUERY SELECT 'INCONSISTENTE'::TEXT, 
      'Extrato NÃO marcado como reconciliado mas TEM vínculos - corrigir'::TEXT;
  ELSE
    RETURN QUERY SELECT 'OK'::TEXT, 'Extrato pendente sem vínculos'::TEXT;
  END IF;
END;
$$;
