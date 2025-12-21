-- 1. Criação da Tabela para compromissos pastorais
CREATE TABLE IF NOT EXISTS public.agenda_pastoral (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pastor_id UUID REFERENCES public.profiles(id) NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    tipo VARCHAR DEFAULT 'COMPROMISSO', -- 'BLOQUEIO', 'FERIAS', 'OUTRO'
    cor VARCHAR DEFAULT 'blue',
    criado_por UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.agenda_pastoral ENABLE ROW LEVEL SECURITY;

-- 3. Políticas usando has_role (padrão do projeto)
-- Leitura: Admin, Pastor, Secretário podem ver toda agenda
CREATE POLICY "Staff pode ver agenda pastoral" ON public.agenda_pastoral
    FOR SELECT
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'pastor'::app_role) OR 
        has_role(auth.uid(), 'secretario'::app_role)
    );

-- Inserir: Admin, Pastor, Secretário podem criar
CREATE POLICY "Staff pode criar agenda pastoral" ON public.agenda_pastoral
    FOR INSERT
    WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'pastor'::app_role) OR 
        has_role(auth.uid(), 'secretario'::app_role)
    );

-- Atualizar: Admin, Pastor (próprios), Secretário
CREATE POLICY "Staff pode atualizar agenda pastoral" ON public.agenda_pastoral
    FOR UPDATE
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'secretario'::app_role) OR
        (has_role(auth.uid(), 'pastor'::app_role) AND pastor_id IN (
            SELECT id FROM public.profiles WHERE user_id = auth.uid()
        ))
    );

-- Deletar: Admin e Secretário
CREATE POLICY "Admin e secretario podem deletar agenda" ON public.agenda_pastoral
    FOR DELETE
    USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'secretario'::app_role)
    );

-- 4. Índices para performance
CREATE INDEX idx_agenda_pastoral_pastor_data ON public.agenda_pastoral (pastor_id, data_inicio);
CREATE INDEX idx_agenda_pastoral_data_range ON public.agenda_pastoral (data_inicio, data_fim);

-- 5. Trigger para updated_at
CREATE TRIGGER update_agenda_pastoral_updated_at
    BEFORE UPDATE ON public.agenda_pastoral
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();