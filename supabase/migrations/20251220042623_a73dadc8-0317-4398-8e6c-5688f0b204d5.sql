-- 1. Enumerações para padronizar
CREATE TYPE gravidade_enum AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');
CREATE TYPE status_atendimento_enum AS ENUM ('PENDENTE', 'TRIAGEM', 'AGENDADO', 'EM_ACOMPANHAMENTO', 'CONCLUIDO');

-- 2. A Tabela Mestra (Prontuário Completo)
CREATE TABLE IF NOT EXISTS atendimentos_pastorais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Vínculos
  pessoa_id uuid REFERENCES profiles(id),
  visitante_id uuid REFERENCES visitantes_leads(id),
  sessao_bot_id uuid REFERENCES atendimentos_bot(id),
  
  -- Dados do Prontuário (SENSÍVEIS)
  origem text DEFAULT 'CHATBOT', 
  motivo_resumo text, 
  conteudo_original text,
  gravidade gravidade_enum DEFAULT 'BAIXA',
  
  -- Gestão
  pastor_responsavel_id uuid REFERENCES profiles(id),
  status status_atendimento_enum DEFAULT 'PENDENTE',
  
  -- Agenda (PÚBLICO PARA SECRETARIA)
  data_agendamento timestamptz,
  local_atendimento text,
  observacoes_internas text
);

-- Trigger para updated_at
CREATE TRIGGER update_atendimentos_pastorais_updated_at
  BEFORE UPDATE ON atendimentos_pastorais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS na tabela principal
ALTER TABLE atendimentos_pastorais ENABLE ROW LEVEL SECURITY;

-- Apenas pastores e admins podem ver/gerenciar atendimentos
CREATE POLICY "Pastores e admins gerenciam atendimentos pastorais"
  ON atendimentos_pastorais FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'pastor'::app_role)
  );

-- Secretários podem ver apenas dados de agenda (via view)
CREATE POLICY "Secretarios podem ver agenda"
  ON atendimentos_pastorais FOR SELECT
  USING (has_role(auth.uid(), 'secretario'::app_role));

-- 4. A View Segura para Secretária
CREATE OR REPLACE VIEW view_agenda_secretaria AS
SELECT 
  ap.id,
  ap.created_at,
  ap.status,
  ap.data_agendamento,
  ap.local_atendimento,
  ap.pastor_responsavel_id,
  p_pastor.nome AS pastor_nome,
  COALESCE(p_pessoa.nome, vl.nome, 'Anônimo') AS pessoa_nome,
  'CONFIDENCIAL' AS conteudo
FROM atendimentos_pastorais ap
LEFT JOIN profiles p_pastor ON p_pastor.id = ap.pastor_responsavel_id
LEFT JOIN profiles p_pessoa ON p_pessoa.id = ap.pessoa_id
LEFT JOIN visitantes_leads vl ON vl.id = ap.visitante_id;

-- 5. Índices para performance
CREATE INDEX idx_atendimentos_pastorais_pessoa ON atendimentos_pastorais(pessoa_id);
CREATE INDEX idx_atendimentos_pastorais_visitante ON atendimentos_pastorais(visitante_id);
CREATE INDEX idx_atendimentos_pastorais_pastor ON atendimentos_pastorais(pastor_responsavel_id);
CREATE INDEX idx_atendimentos_pastorais_status ON atendimentos_pastorais(status);
CREATE INDEX idx_atendimentos_pastorais_data ON atendimentos_pastorais(data_agendamento);