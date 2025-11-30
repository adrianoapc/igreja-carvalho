-- Criar tabela de times/equipes
CREATE TABLE public.times_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL, -- musica, tecnico, kids, hospitalidade, outro
  descricao TEXT,
  cor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de posições dentro dos times
CREATE TABLE public.posicoes_time (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id UUID NOT NULL REFERENCES public.times_culto(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de membros atribuídos aos times
CREATE TABLE public.membros_time (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id UUID NOT NULL REFERENCES public.times_culto(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  posicao_id UUID REFERENCES public.posicoes_time(id) ON DELETE SET NULL,
  data_entrada DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(time_id, pessoa_id, posicao_id)
);

-- Criar tabela de cultos/eventos
CREATE TABLE public.cultos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL, -- celebracao, oracao, jovens, kids, etc
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_culto TIMESTAMP WITH TIME ZONE NOT NULL,
  duracao_minutos INTEGER,
  local TEXT,
  pregador TEXT,
  tema TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'planejado', -- planejado, confirmado, realizado, cancelado
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de escalas (quem está escalado em cada culto)
CREATE TABLE public.escalas_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  time_id UUID NOT NULL REFERENCES public.times_culto(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  posicao_id UUID REFERENCES public.posicoes_time(id) ON DELETE SET NULL,
  confirmado BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(culto_id, pessoa_id, posicao_id)
);

-- Criar tabela de liturgia do culto
CREATE TABLE public.liturgia_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- cabecalho, item, cancao, midia, aviso
  titulo TEXT NOT NULL,
  descricao TEXT,
  duracao_minutos INTEGER,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de canções
CREATE TABLE public.cancoes_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  artista TEXT,
  tom TEXT,
  bpm INTEGER,
  duracao_minutos INTEGER,
  letra TEXT,
  cifra TEXT,
  link_youtube TEXT,
  link_spotify TEXT,
  ordem INTEGER NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de mídias
CREATE TABLE public.midias_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL, -- video, imagem, audio, documento
  url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.times_culto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posicoes_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalas_culto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liturgia_culto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancoes_culto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midias_culto ENABLE ROW LEVEL SECURITY;

-- RLS Policies para times_culto
CREATE POLICY "Admins podem gerenciar times"
  ON public.times_culto
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver times ativos"
  ON public.times_culto
  FOR SELECT
  USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para posicoes_time
CREATE POLICY "Admins podem gerenciar posições"
  ON public.posicoes_time
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver posições ativas"
  ON public.posicoes_time
  FOR SELECT
  USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies para membros_time
CREATE POLICY "Admins podem gerenciar membros de times"
  ON public.membros_time
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver membros de times"
  ON public.membros_time
  FOR SELECT
  USING (true);

-- RLS Policies para cultos
CREATE POLICY "Admins podem gerenciar cultos"
  ON public.cultos
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver cultos"
  ON public.cultos
  FOR SELECT
  USING (true);

-- RLS Policies para escalas_culto
CREATE POLICY "Admins podem gerenciar escalas"
  ON public.escalas_culto
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver escalas"
  ON public.escalas_culto
  FOR SELECT
  USING (true);

CREATE POLICY "Membros podem confirmar suas próprias escalas"
  ON public.escalas_culto
  FOR UPDATE
  USING (pessoa_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS Policies para liturgia_culto
CREATE POLICY "Admins podem gerenciar liturgia"
  ON public.liturgia_culto
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver liturgia"
  ON public.liturgia_culto
  FOR SELECT
  USING (true);

-- RLS Policies para cancoes_culto
CREATE POLICY "Admins podem gerenciar canções"
  ON public.cancoes_culto
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver canções"
  ON public.cancoes_culto
  FOR SELECT
  USING (true);

-- RLS Policies para midias_culto
CREATE POLICY "Admins podem gerenciar mídias"
  ON public.midias_culto
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver mídias"
  ON public.midias_culto
  FOR SELECT
  USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_times_culto_updated_at
  BEFORE UPDATE ON public.times_culto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posicoes_time_updated_at
  BEFORE UPDATE ON public.posicoes_time
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_membros_time_updated_at
  BEFORE UPDATE ON public.membros_time
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cultos_updated_at
  BEFORE UPDATE ON public.cultos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_escalas_culto_updated_at
  BEFORE UPDATE ON public.escalas_culto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liturgia_culto_updated_at
  BEFORE UPDATE ON public.liturgia_culto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cancoes_culto_updated_at
  BEFORE UPDATE ON public.cancoes_culto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_midias_culto_updated_at
  BEFORE UPDATE ON public.midias_culto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();