-- Criar tabela de Catálogo de Eventos (O que pode acontecer no sistema)
CREATE TABLE public.notificacao_eventos (
    slug TEXT PRIMARY KEY, -- Ex: 'novo_visitante', 'conta_vencer', 'jornada_concluida'
    nome TEXT NOT NULL, -- Ex: 'Novo Visitante Cadastrado'
    descricao TEXT,
    categoria TEXT NOT NULL, -- Ex: 'pessoas', 'financeiro', 'kids'
    variaveis_disponiveis TEXT[], -- Ex: ['nome_visitante', 'data', 'valor']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de Regras de Envio (Quem recebe e por onde)
CREATE TABLE public.notificacao_regras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evento_slug TEXT REFERENCES public.notificacao_eventos(slug) ON DELETE CASCADE,
    
    -- Destinatário (Pode ser um Cargo ou um Usuário específico)
    destinatario_role public.app_role, -- Ex: 'lider', 'tesoureiro'
    destinatario_user_id UUID REFERENCES auth.users(id), -- Opcional, para overrides
    
    -- Canais Ativos (Quais vias serão usadas)
    canal_in_app BOOLEAN DEFAULT true, -- Sininho no sistema
    canal_push BOOLEAN DEFAULT false, -- Notificação no celular
    canal_whatsapp BOOLEAN DEFAULT false, -- Via API/Make
    canal_email BOOLEAN DEFAULT false, -- Email
    
    -- Configuração
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir os eventos padrão do sistema
INSERT INTO public.notificacao_eventos (slug, nome, categoria, variaveis_disponiveis) VALUES
('novo_visitante', 'Novo Visitante', 'pessoas', ARRAY['nome', 'telefone']),
('financeiro_vencimento', 'Conta a Pagar Vencendo', 'financeiro', ARRAY['descricao', 'valor', 'data_vencimento']),
('financeiro_aprovacao', 'Reembolso Aguardando Aprovação', 'financeiro', ARRAY['solicitante', 'valor']),
('kids_checkin', 'Criança Entrou (Check-in)', 'kids', ARRAY['nome_crianca', 'responsavel']),
('kids_ocorrencia', 'Ocorrência/Choro no Kids', 'kids', ARRAY['nome_crianca', 'motivo']),
('jornada_conclusao', 'Conclusão de Jornada', 'ensino', ARRAY['nome_aluno', 'jornada']);

-- Inserir regras padrão (Exemplos iniciais)
INSERT INTO public.notificacao_regras (evento_slug, destinatario_role, canal_in_app, canal_push, canal_whatsapp) VALUES
('novo_visitante', 'lider', true, true, true),
('financeiro_vencimento', 'tesoureiro', true, true, true),
('kids_ocorrencia', 'admin', true, true, true);

-- Habilitar RLS
ALTER TABLE public.notificacao_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_regras ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Admins gerenciam eventos" ON public.notificacao_eventos
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leitura publica eventos" ON public.notificacao_eventos
    FOR SELECT USING (true);

CREATE POLICY "Admins gerenciam regras" ON public.notificacao_regras
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leitura publica regras" ON public.notificacao_regras
    FOR SELECT USING (true);