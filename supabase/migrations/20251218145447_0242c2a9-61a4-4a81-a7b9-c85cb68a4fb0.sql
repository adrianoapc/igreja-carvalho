-- ============================================
-- FASE 1: Módulo Intercessão V2 - Schema de Banco de Dados
-- ADR-012: CRM de Evangelismo, Chatbot IA e Compliance
-- ============================================

-- 1. CRIAR TIPOS ENUM
-- ============================================

-- Status de disponibilidade do intercessor
CREATE TYPE status_intercessor AS ENUM ('ATIVO', 'PAUSA', 'FERIAS');

-- Status da sessão de chat com o bot
CREATE TYPE status_sessao_chat AS ENUM ('INICIADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'EXPIRADO');

-- 2. CRIAR TABELA VISITANTES (CRM de Evangelismo)
-- ============================================
CREATE TABLE public.visitantes_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255),
    telefone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    origem VARCHAR(50) DEFAULT 'WABA',
    estagio_funil VARCHAR(50) DEFAULT 'NOVO', -- NOVO, EM_ORACAO, CONTATO_REALIZADO, VISITOU, CONVERTIDO
    observacoes TEXT,
    data_ultimo_contato TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca por telefone
CREATE INDEX idx_visitantes_leads_telefone ON public.visitantes_leads(telefone);
CREATE INDEX idx_visitantes_leads_estagio ON public.visitantes_leads(estagio_funil);

-- RLS para visitantes_leads
ALTER TABLE public.visitantes_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar visitantes leads"
ON public.visitantes_leads FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pastor'::app_role));

CREATE POLICY "Intercessores podem ver visitantes leads"
ON public.visitantes_leads FOR SELECT
USING (EXISTS (SELECT 1 FROM public.intercessores WHERE user_id = auth.uid() AND ativo = true));

-- 3. CRIAR TABELA ATENDIMENTOS_BOT (Estado do Chat)
-- ============================================
CREATE TABLE public.atendimentos_bot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telefone VARCHAR(20) NOT NULL,
    status status_sessao_chat DEFAULT 'INICIADO',
    historico_conversa JSONB DEFAULT '[]'::jsonb,
    meta_dados JSONB DEFAULT '{}'::jsonb, -- Dados parciais extraídos pela IA
    pessoa_id UUID REFERENCES public.profiles(id), -- Se identificado como membro
    visitante_id UUID REFERENCES public.visitantes_leads(id), -- Se é lead externo
    ultima_mensagem_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_atendimentos_bot_telefone ON public.atendimentos_bot(telefone);
CREATE INDEX idx_atendimentos_bot_status ON public.atendimentos_bot(status);
CREATE INDEX idx_atendimentos_bot_ultima_msg ON public.atendimentos_bot(ultima_mensagem_at);

-- RLS para atendimentos_bot
ALTER TABLE public.atendimentos_bot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema pode inserir atendimentos"
ON public.atendimentos_bot FOR INSERT
WITH CHECK (true); -- Edge functions inserem via service_role

CREATE POLICY "Admins podem gerenciar atendimentos"
ON public.atendimentos_bot FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pastor'::app_role));

CREATE POLICY "Intercessores podem ver atendimentos"
ON public.atendimentos_bot FOR SELECT
USING (EXISTS (SELECT 1 FROM public.intercessores WHERE user_id = auth.uid() AND ativo = true));

-- 4. CRIAR TABELA LOGS_AUDITORIA_CHAT (Compliance/LGPD - Append-Only)
-- ============================================
CREATE TABLE public.logs_auditoria_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id UUID REFERENCES public.atendimentos_bot(id) ON DELETE CASCADE,
    ator VARCHAR(20) NOT NULL CHECK (ator IN ('USER', 'BOT', 'SYSTEM')),
    tipo_evento VARCHAR(50), -- MENSAGEM, ANALISE_IA, TRANSFERENCIA, ERRO
    payload_raw JSONB NOT NULL,
    ip_origem VARCHAR(45), -- IPv4 ou IPv6
    timestamp_exato TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para auditoria
CREATE INDEX idx_logs_auditoria_sessao ON public.logs_auditoria_chat(sessao_id);
CREATE INDEX idx_logs_auditoria_timestamp ON public.logs_auditoria_chat(timestamp_exato);

-- RLS para logs_auditoria_chat (APPEND-ONLY)
ALTER TABLE public.logs_auditoria_chat ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Apenas INSERT permitido via API pública
CREATE POLICY "Sistema pode inserir logs"
ON public.logs_auditoria_chat FOR INSERT
WITH CHECK (true); -- Edge functions inserem via service_role

-- Apenas admins podem VER (nunca editar/deletar)
CREATE POLICY "Admins podem visualizar logs auditoria"
ON public.logs_auditoria_chat FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- NÃO criar políticas de UPDATE ou DELETE (Append-Only por design)

-- 5. ATUALIZAR TABELA INTERCESSORES
-- ============================================
ALTER TABLE public.intercessores 
ADD COLUMN IF NOT EXISTS status_disponibilidade status_intercessor DEFAULT 'ATIVO';

-- Índice para filtrar por disponibilidade
CREATE INDEX IF NOT EXISTS idx_intercessores_disponibilidade ON public.intercessores(status_disponibilidade);

-- 6. ATUALIZAR TABELA PEDIDOS_ORACAO
-- ============================================
ALTER TABLE public.pedidos_oracao 
ADD COLUMN IF NOT EXISTS texto_na_integra TEXT,
ADD COLUMN IF NOT EXISTS origem VARCHAR(50) DEFAULT 'APP',
ADD COLUMN IF NOT EXISTS visitante_id UUID REFERENCES public.visitantes_leads(id);

-- Índice para filtrar por origem
CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_origem ON public.pedidos_oracao(origem);
CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_visitante ON public.pedidos_oracao(visitante_id);

-- 7. TRIGGER PARA UPDATED_AT
-- ============================================
CREATE TRIGGER update_visitantes_leads_updated_at
    BEFORE UPDATE ON public.visitantes_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_atendimentos_bot_updated_at
    BEFORE UPDATE ON public.atendimentos_bot
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 8. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================
COMMENT ON TABLE public.visitantes_leads IS 'CRM de Evangelismo - Leads externos que entraram via WhatsApp/Bot';
COMMENT ON TABLE public.atendimentos_bot IS 'Controle de sessão do chatbot de triagem (State Machine)';
COMMENT ON TABLE public.logs_auditoria_chat IS 'Audit log imutável para compliance LGPD - Append-Only';
COMMENT ON COLUMN public.logs_auditoria_chat.payload_raw IS 'JSON bruto da mensagem para prova jurídica';
COMMENT ON COLUMN public.intercessores.status_disponibilidade IS 'Controle de carga: ATIVO, PAUSA ou FERIAS';