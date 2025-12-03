-- 1. A Definição da Trilha (ex: "Escola de Líderes 2025", "Consolidação")
CREATE TABLE public.jornadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  cor_tema TEXT DEFAULT '#3b82f6',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. As Colunas do Kanban (ex: "Aula 1", "Prova Prática")
CREATE TABLE public.etapas_jornada (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada_id UUID NOT NULL REFERENCES public.jornadas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. A Inscrição (Quem está em qual fase)
CREATE TABLE public.inscricoes_jornada (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada_id UUID NOT NULL REFERENCES public.jornadas(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  etapa_atual_id UUID REFERENCES public.etapas_jornada(id),
  responsavel_id UUID REFERENCES public.profiles(id),
  data_entrada TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_mudanca_fase TIMESTAMP WITH TIME ZONE DEFAULT now(),
  concluido BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(jornada_id, pessoa_id)
);

-- RLS
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etapas_jornada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscricoes_jornada ENABLE ROW LEVEL SECURITY;

-- Políticas para jornadas
CREATE POLICY "Todos podem ver jornadas ativas" ON public.jornadas 
  FOR SELECT USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar jornadas" ON public.jornadas 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para etapas_jornada
CREATE POLICY "Todos podem ver etapas" ON public.etapas_jornada 
  FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar etapas" ON public.etapas_jornada 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para inscricoes_jornada
CREATE POLICY "Admins podem ver todas inscrições" ON public.inscricoes_jornada 
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Responsáveis podem ver suas inscrições" ON public.inscricoes_jornada 
  FOR SELECT USING (responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Membros podem ver própria inscrição" ON public.inscricoes_jornada 
  FOR SELECT USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem gerenciar inscrições" ON public.inscricoes_jornada 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers para updated_at
CREATE TRIGGER update_jornadas_updated_at BEFORE UPDATE ON public.jornadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_etapas_jornada_updated_at BEFORE UPDATE ON public.etapas_jornada
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inscricoes_jornada_updated_at BEFORE UPDATE ON public.inscricoes_jornada
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();