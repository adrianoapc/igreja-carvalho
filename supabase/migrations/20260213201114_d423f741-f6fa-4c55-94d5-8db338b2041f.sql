-- Adicionar status de conciliação nas transações financeiras
ALTER TABLE public.transacoes_financeiras
ADD COLUMN conciliacao_status TEXT NOT NULL DEFAULT 'nao_conciliado';

ALTER TABLE public.transacoes_financeiras
ADD CONSTRAINT transacoes_financeiras_conciliacao_status_check
CHECK (conciliacao_status IN (
  'nao_conciliado',
  'conciliado_manual',
  'conciliado_extrato',
  'conciliado_bot'
));

-- Backfill: transações conciliadas por extrato/lote/divisão
UPDATE public.transacoes_financeiras t
SET conciliacao_status = 'conciliado_extrato'
WHERE EXISTS (
  SELECT 1 FROM public.extratos_bancarios e
  WHERE e.transacao_vinculada_id = t.id
)
OR EXISTS (
  SELECT 1 FROM public.conciliacoes_lote l
  WHERE l.transacao_id = t.id
)
OR EXISTS (
  SELECT 1 FROM public.conciliacoes_divisao_transacoes d
  WHERE d.transacao_id = t.id
);

-- Backfill: transações conferidas manualmente (caixa/dinheiro)
UPDATE public.transacoes_financeiras t
SET conciliacao_status = 'conciliado_manual'
WHERE t.conferido_manual = true
AND t.conciliacao_status = 'nao_conciliado';

-- Atualizar função aplicar_conciliacao para marcar conciliação por extrato
CREATE OR REPLACE FUNCTION public.aplicar_conciliacao(
  p_extrato_id UUID,
  p_transacao_id UUID,
  p_tipo TEXT DEFAULT 'automatica',
  p_score INTEGER DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_extrato RECORD;
  v_transacao RECORD;
BEGIN
  -- Buscar dados do extrato
  SELECT id, conta_id, valor, igreja_id, filial_id
  INTO v_extrato
  FROM extratos_bancarios
  WHERE id = p_extrato_id;
  IF v_extrato IS NULL THEN
    RAISE EXCEPTION 'Extrato não encontrado';
  END IF;

  -- Buscar dados da transação
  SELECT id, valor
  INTO v_transacao
  FROM transacoes_financeiras
  WHERE id = p_transacao_id;
  IF v_transacao IS NULL THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;

  -- Marcar extrato como reconciliado
  UPDATE extratos_bancarios
  SET reconciliado = TRUE,
      transacao_vinculada_id = p_transacao_id
  WHERE id = p_extrato_id;

  -- Marcar transação como conciliada via extrato
  UPDATE transacoes_financeiras
  SET conciliacao_status = 'conciliado_extrato'
  WHERE id = p_transacao_id;

  -- Inserir log de auditoria
  INSERT INTO reconciliacao_audit_logs (
    extrato_id,
    transacao_id,
    igreja_id,
    filial_id,
    conta_id,
    tipo_reconciliacao,
    score,
    valor_extrato,
    valor_transacao,
    diferenca,
    usuario_id
  ) VALUES (
    p_extrato_id,
    p_transacao_id,
    v_extrato.igreja_id,
    v_extrato.filial_id,
    v_extrato.conta_id,
    p_tipo,
    p_score,
    v_extrato.valor,
    v_transacao.valor,
    ABS(v_extrato.valor - v_transacao.valor),
    p_usuario_id
  );

  RETURN TRUE;
END;
$$;