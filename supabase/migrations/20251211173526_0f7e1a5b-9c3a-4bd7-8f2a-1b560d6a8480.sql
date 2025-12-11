-- Remover tabelas existentes para recriar com nova estrutura
DROP TABLE IF EXISTS public.notificacao_regras CASCADE;
DROP TABLE IF EXISTS public.notificacao_eventos CASCADE;

-- Tabela de Catálogo de Eventos
CREATE TABLE public.notificacao_eventos (
    slug TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    provider_preferencial TEXT DEFAULT 'make' CHECK (provider_preferencial IN ('make', 'meta_direto')),
    template_meta TEXT,
    variaveis TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Regras de Envio
CREATE TABLE public.notificacao_regras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evento_slug TEXT REFERENCES public.notificacao_eventos(slug) ON DELETE CASCADE,
    role_alvo TEXT,
    user_id_especifico UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    canais JSONB DEFAULT '{"in_app": true, "push": false, "whatsapp": false}'::jsonb,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir eventos básicos
INSERT INTO public.notificacao_eventos (slug, nome, categoria, variaveis) VALUES
('novo_visitante', 'Novo Visitante Cadastrado', 'pessoas', ARRAY['nome', 'telefone', 'email']),
('kids_checkin', 'Check-in de Criança', 'kids', ARRAY['nome_crianca', 'responsavel', 'sala']),
('financeiro_conta_vencer', 'Conta a Vencer', 'financeiro', ARRAY['descricao', 'valor', 'data_vencimento']),
('pedido_oracao_recebido', 'Novo Pedido de Oração', 'intercessao', ARRAY['nome_solicitante', 'tipo', 'pedido']);

-- Inserir regra de exemplo
INSERT INTO public.notificacao_regras (evento_slug, role_alvo, canais) VALUES
('financeiro_conta_vencer', 'admin', '{"in_app": true, "push": true, "whatsapp": true}'::jsonb);

-- Habilitar RLS
ALTER TABLE public.notificacao_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacao_regras ENABLE ROW LEVEL SECURITY;

-- Políticas para notificacao_eventos
CREATE POLICY "Leitura publica eventos" ON public.notificacao_eventos
    FOR SELECT USING (true);

CREATE POLICY "Admins gerenciam eventos" ON public.notificacao_eventos
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para notificacao_regras
CREATE POLICY "Leitura publica regras" ON public.notificacao_regras
    FOR SELECT USING (true);

CREATE POLICY "Admins gerenciam regras" ON public.notificacao_regras
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));