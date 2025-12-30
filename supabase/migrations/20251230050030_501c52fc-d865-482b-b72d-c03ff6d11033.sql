-- ==========================================
-- MÓDULO DE INSCRIÇÕES DE EVENTOS (Conferências)
-- ==========================================

-- 1. Adicionar campos de pagamento à tabela eventos
ALTER TABLE eventos 
ADD COLUMN IF NOT EXISTS requer_inscricao BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requer_pagamento BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS valor_inscricao NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS categoria_financeira_id UUID REFERENCES categorias_financeiras(id),
ADD COLUMN IF NOT EXISTS conta_financeira_id UUID REFERENCES contas(id),
ADD COLUMN IF NOT EXISTS vagas_limite INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS inscricoes_abertas_ate TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Criar tabela de inscrições de eventos
CREATE TABLE IF NOT EXISTS inscricoes_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  responsavel_inscricao_id UUID REFERENCES profiles(id),
  status_pagamento TEXT NOT NULL DEFAULT 'isento' CHECK (status_pagamento IN ('isento', 'pendente', 'pago', 'cancelado')),
  transacao_id UUID REFERENCES transacoes_financeiras(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(evento_id, pessoa_id)
);

-- 3. Trigger para updated_at
CREATE TRIGGER update_inscricoes_eventos_updated_at
  BEFORE UPDATE ON inscricoes_eventos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Habilitar RLS
ALTER TABLE inscricoes_eventos ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de segurança

-- Admins podem gerenciar todas as inscrições
CREATE POLICY "Admins podem gerenciar inscricoes_eventos"
  ON inscricoes_eventos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem ver suas próprias inscrições
CREATE POLICY "Usuarios podem ver proprias inscricoes"
  ON inscricoes_eventos FOR SELECT
  USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Usuários podem criar inscrições para si mesmos
CREATE POLICY "Usuarios podem criar proprias inscricoes"
  ON inscricoes_eventos FOR INSERT
  WITH CHECK (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Responsáveis podem ver inscrições que criaram
CREATE POLICY "Responsaveis podem ver inscricoes criadas"
  ON inscricoes_eventos FOR SELECT
  USING (responsavel_inscricao_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_inscricoes_eventos_evento ON inscricoes_eventos(evento_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_eventos_pessoa ON inscricoes_eventos(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_eventos_status ON inscricoes_eventos(status_pagamento);

-- 7. Garantir categoria financeira para eventos (opcional, se não existir)
INSERT INTO categorias_financeiras (nome, tipo, secao_dre, ativo)
VALUES ('Inscrições em Eventos', 'entrada', 'Receitas', true)
ON CONFLICT DO NOTHING;