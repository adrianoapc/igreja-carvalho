-- Projetos
CREATE TABLE public.projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  data_inicio DATE,
  data_fim DATE,
  lider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projetos_status ON public.projetos(status);
CREATE INDEX idx_projetos_lider ON public.projetos(lider_id);

-- Tarefas (Kanban)
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  prioridade TEXT DEFAULT 'media',
  data_vencimento DATE,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tarefas_projeto ON public.tarefas(projeto_id);
CREATE INDEX idx_tarefas_status ON public.tarefas(status);
CREATE INDEX idx_tarefas_responsavel ON public.tarefas(responsavel_id);

-- Triggers using existing function
CREATE TRIGGER trg_projetos_updated
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_tarefas_updated
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

-- Projetos: admins/líderes gerenciam, secretários visualizam
CREATE POLICY "Admins e lideres gerenciam projetos" ON public.projetos
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'lider'::app_role)
  );

CREATE POLICY "Secretarios visualizam projetos" ON public.projetos
  FOR SELECT USING (has_role(auth.uid(), 'secretario'::app_role));

CREATE POLICY "Membros veem projetos onde sao responsaveis" ON public.projetos
  FOR SELECT USING (
    lider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Tarefas: admins/líderes gerenciam, secretários visualizam
CREATE POLICY "Admins e lideres gerenciam tarefas" ON public.tarefas
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'lider'::app_role)
  );

CREATE POLICY "Secretarios visualizam tarefas" ON public.tarefas
  FOR SELECT USING (has_role(auth.uid(), 'secretario'::app_role));

CREATE POLICY "Responsaveis gerenciam suas tarefas" ON public.tarefas
  FOR ALL USING (
    responsavel_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );