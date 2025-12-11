-- Tabela: notificacao_regras
-- Armazena configurações de como disparar alertas para cada evento
CREATE TABLE IF NOT EXISTS notificacao_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento VARCHAR(100) NOT NULL UNIQUE, -- slug do evento (ex: 'novo_visitante')
  titulo_template TEXT NOT NULL, -- template com {{variáveis}}
  mensagem_template TEXT NOT NULL, -- template com {{variáveis}}
  descricao TEXT,
  
  -- Destinação
  role_destinatario VARCHAR(50), -- role para enviar (ex: 'pastor', 'tesoureiro', null = específico)
  
  -- Canais
  canal_inapp BOOLEAN DEFAULT true,
  canal_whatsapp BOOLEAN DEFAULT false,
  canal_push BOOLEAN DEFAULT false,
  
  -- Auditoria
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacao_regras_evento ON notificacao_regras(evento);
CREATE INDEX IF NOT EXISTS idx_notificacao_regras_ativo ON notificacao_regras(ativo);

-- Tabela: notifications
-- Armazena notificações in-app para usuários
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  tipo VARCHAR(100), -- tipo de notificação (evento que gerou)
  icone VARCHAR(50), -- nome do ícone (opcional)
  cor VARCHAR(20), -- cor do tema (opcional)
  link VARCHAR(500), -- link para ação (opcional)
  
  -- Status
  lido BOOLEAN DEFAULT false,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_lido ON notifications(user_id, lido);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS: Usuário só vê suas próprias notificações
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem suas próprias notificações" ON notifications;
CREATE POLICY "Usuários veem suas próprias notificações"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários marcam leitura de suas notificações" ON notifications;
CREATE POLICY "Usuários marcam leitura de suas notificações"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Dados de exemplo
INSERT INTO notificacao_regras (evento, titulo_template, mensagem_template, role_destinatario, canal_inapp, canal_whatsapp, descricao)
VALUES
  ('novo_visitante', 'Novo Visitante', 'Um novo visitante chegou: {{nome}}', 'pastor', true, true, 'Notifica pastor quando visitante se registra'),
  ('reembolso_solicitado', 'Nova Solicitação de Reembolso', '{{solicitante}} solicitou R$ {{valor}}', 'tesoureiro', true, true, 'Notifica tesoureiro de novo reembolso'),
  ('reembolso_aprovado', 'Reembolso Aprovado', 'Seu reembolso de R$ {{valor}} foi aprovado!', null, true, false, 'Notifica solicitante quando aprovado (user_id_alvo)'),
  ('tarefas_atrasadas', 'Tarefas Atrasadas', 'Você tem {{quantidade}} tarefa(s) atrasada(s)', 'lider_projeto', true, false, 'Notifica líderes sobre tarefas atrasadas'),
  ('evento_proxima_semana', 'Evento Próximo', '{{evento}} acontece em {{dias}} dia(s) - {{local}}', 'membro', true, true, 'Lembra membros de eventos próximos')
ON CONFLICT (evento) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE notificacao_regras IS 'Regras de disparo de notificações - determina quando e como notificar usuários';
COMMENT ON TABLE notifications IS 'Histórico de notificações in-app enviadas aos usuários';
