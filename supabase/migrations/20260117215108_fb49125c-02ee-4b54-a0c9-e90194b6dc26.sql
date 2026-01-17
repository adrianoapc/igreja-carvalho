-- Tabela temporária para receber webhooks de PIX
-- Propósito: Input para processamento e vinculação com relatório de ofertas

CREATE TABLE IF NOT EXISTS pix_webhook_temp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dados do PIX
  pix_id TEXT NOT NULL UNIQUE,
  valor DECIMAL(15, 2) NOT NULL,
  pagador_cpf_cnpj TEXT,
  pagador_nome TEXT,
  descricao TEXT,
  -- Timestamps críticos
  data_pix TIMESTAMP WITH TIME ZONE NOT NULL,
  data_recebimento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Status de processamento
  status TEXT NOT NULL DEFAULT 'recebido',
  -- Identificação da instituição
  banco_id TEXT,
  igreja_id UUID NOT NULL REFERENCES igrejas(id),
  -- Payload completo para auditoria
  webhook_payload JSONB,
  -- Vinculação com sistema
  transacao_id UUID REFERENCES transacoes_financeiras(id),
  oferta_id UUID,
  -- Rastreamento de erros
  processado_em TIMESTAMP WITH TIME ZONE,
  erro_mensagem TEXT,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT pix_webhook_status_enum CHECK (status IN ('recebido', 'processado', 'vinculado', 'erro'))
);

-- Índices para performance
CREATE INDEX idx_pix_webhook_temp_igreja_id ON pix_webhook_temp(igreja_id);
CREATE INDEX idx_pix_webhook_temp_status ON pix_webhook_temp(status);
CREATE INDEX idx_pix_webhook_temp_data_pix ON pix_webhook_temp(data_pix);
CREATE INDEX idx_pix_webhook_temp_pix_id ON pix_webhook_temp(pix_id);

-- RLS: Cada igreja só vê seus PIX
ALTER TABLE pix_webhook_temp ENABLE ROW LEVEL SECURITY;

-- Política de leitura: usuários da mesma igreja
CREATE POLICY "pix_webhook_temp_read" ON pix_webhook_temp
FOR SELECT
USING (
  igreja_id IN (
    SELECT p.igreja_id FROM profiles p WHERE p.user_id = auth.uid()
  )
);

-- Política de inserção: webhook aberto (será restrito por edge function/service role)
CREATE POLICY "pix_webhook_temp_insert" ON pix_webhook_temp
FOR INSERT
WITH CHECK (true);

-- Política de atualização: usuários da mesma igreja
CREATE POLICY "pix_webhook_temp_update" ON pix_webhook_temp
FOR UPDATE
USING (
  igreja_id IN (
    SELECT p.igreja_id FROM profiles p WHERE p.user_id = auth.uid()
  )
);

-- Trigger: Atualizar updated_at
CREATE OR REPLACE FUNCTION update_pix_webhook_temp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pix_webhook_temp_updated_at
BEFORE UPDATE ON pix_webhook_temp
FOR EACH ROW
EXECUTE FUNCTION update_pix_webhook_temp_updated_at();