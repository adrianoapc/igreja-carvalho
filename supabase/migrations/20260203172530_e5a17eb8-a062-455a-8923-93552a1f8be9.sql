-- Tabela de logs de auditoria para reconciliação
CREATE TABLE public.reconciliacao_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  extrato_id UUID REFERENCES extratos_bancarios(id) ON DELETE SET NULL,
  transacao_id UUID REFERENCES transacoes_financeiras(id) ON DELETE SET NULL,
  conciliacao_lote_id UUID REFERENCES conciliacoes_lote(id) ON DELETE SET NULL,
  igreja_id UUID REFERENCES igrejas(id),
  filial_id UUID REFERENCES filiais(id),
  conta_id UUID REFERENCES contas(id),
  tipo_reconciliacao TEXT NOT NULL CHECK (tipo_reconciliacao IN ('automatica', 'manual', 'lote')),
  score INTEGER, -- Score de matching para reconciliação automática
  valor_extrato NUMERIC(15,2),
  valor_transacao NUMERIC(15,2),
  diferenca NUMERIC(15,2),
  usuario_id UUID, -- Quem fez a reconciliação (null para automática)
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas de relatório
CREATE INDEX idx_reconciliacao_audit_logs_igreja ON reconciliacao_audit_logs(igreja_id);
CREATE INDEX idx_reconciliacao_audit_logs_filial ON reconciliacao_audit_logs(filial_id);
CREATE INDEX idx_reconciliacao_audit_logs_conta ON reconciliacao_audit_logs(conta_id);
CREATE INDEX idx_reconciliacao_audit_logs_created_at ON reconciliacao_audit_logs(created_at);
CREATE INDEX idx_reconciliacao_audit_logs_tipo ON reconciliacao_audit_logs(tipo_reconciliacao);

-- Enable RLS
ALTER TABLE public.reconciliacao_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view audit logs from their church"
ON public.reconciliacao_audit_logs FOR SELECT
USING (
  igreja_id IN (
    SELECT igreja_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert audit logs for their church"
ON public.reconciliacao_audit_logs FOR INSERT
WITH CHECK (
  igreja_id IN (
    SELECT igreja_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Atualizar função aplicar_conciliacao para logar automaticamente
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

-- View para relatório de cobertura de reconciliação
CREATE OR REPLACE VIEW public.view_reconciliacao_cobertura AS
SELECT 
  e.igreja_id,
  e.filial_id,
  e.conta_id,
  c.nome AS conta_nome,
  DATE_TRUNC('month', e.data_transacao) AS periodo,
  COUNT(*) AS total_extratos,
  COUNT(*) FILTER (WHERE e.reconciliado = TRUE) AS extratos_reconciliados,
  COUNT(*) FILTER (WHERE e.reconciliado = FALSE) AS extratos_pendentes,
  ROUND(
    (COUNT(*) FILTER (WHERE e.reconciliado = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
    2
  ) AS percentual_cobertura,
  SUM(ABS(e.valor)) AS valor_total,
  SUM(ABS(e.valor)) FILTER (WHERE e.reconciliado = TRUE) AS valor_reconciliado,
  SUM(ABS(e.valor)) FILTER (WHERE e.reconciliado = FALSE) AS valor_pendente
FROM extratos_bancarios e
LEFT JOIN contas c ON c.id = e.conta_id
GROUP BY e.igreja_id, e.filial_id, e.conta_id, c.nome, DATE_TRUNC('month', e.data_transacao);

-- View para estatísticas de tipo de reconciliação
CREATE OR REPLACE VIEW public.view_reconciliacao_estatisticas AS
SELECT 
  r.igreja_id,
  r.filial_id,
  r.conta_id,
  DATE_TRUNC('month', r.created_at) AS periodo,
  r.tipo_reconciliacao,
  COUNT(*) AS quantidade,
  SUM(r.valor_extrato) AS valor_total,
  AVG(r.score) FILTER (WHERE r.score IS NOT NULL) AS score_medio,
  AVG(r.diferenca) AS diferenca_media
FROM reconciliacao_audit_logs r
GROUP BY r.igreja_id, r.filial_id, r.conta_id, DATE_TRUNC('month', r.created_at), r.tipo_reconciliacao;