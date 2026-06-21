-- Tabela para armazenar extratos bancários importados
CREATE TABLE IF NOT EXISTS extratos_bancarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais(id) ON DELETE SET NULL,
  data_transacao DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  saldo NUMERIC(14,2),
  numero_documento TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
  reconciliado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_conta ON extratos_bancarios(conta_id);
CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_data ON extratos_bancarios(data_transacao);
CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_igreja ON extratos_bancarios(igreja_id);
CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_filial ON extratos_bancarios(filial_id);
