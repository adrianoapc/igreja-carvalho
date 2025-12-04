-- ==============================================================================
-- MASTER SCRIPT: IGREJA APP 2.0 (Mídias, Liturgia, Ensino Híbrido & EAD)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATUALIZAÇÃO TABELA MIDIAS (adiciona tags se não existir)
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'midias' AND column_name = 'tags') THEN
    ALTER TABLE public.midias ADD COLUMN tags TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'midias' AND column_name = 'created_by') THEN
    ALTER TABLE public.midias ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TEMPLATES DE LITURGIA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.liturgia_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  estrutura_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. MÓDULO DE ENSINO (Salas e Aulas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  capacidade INTEGER DEFAULT 20,
  idade_min INTEGER, 
  idade_max INTEGER,
  tipo TEXT DEFAULT 'kids',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aulas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sala_id UUID REFERENCES public.salas(id),       
  jornada_id UUID REFERENCES public.jornadas(id),
  culto_id UUID REFERENCES public.cultos(id),
  tema TEXT,
  professor_id UUID REFERENCES public.profiles(id),
  data_inicio TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER DEFAULT 60,
  modalidade TEXT DEFAULT 'presencial',
  link_reuniao TEXT,
  status TEXT DEFAULT 'agendada',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. MÓDULO EAD (Enriquece etapas_jornada)
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas_jornada' AND column_name = 'tipo_conteudo') THEN
    ALTER TABLE public.etapas_jornada ADD COLUMN tipo_conteudo TEXT DEFAULT 'check';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas_jornada' AND column_name = 'conteudo_url') THEN
    ALTER TABLE public.etapas_jornada ADD COLUMN conteudo_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas_jornada' AND column_name = 'conteudo_texto') THEN
    ALTER TABLE public.etapas_jornada ADD COLUMN conteudo_texto TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas_jornada' AND column_name = 'aula_vinculada_id') THEN
    ALTER TABLE public.etapas_jornada ADD COLUMN aula_vinculada_id UUID;
  END IF;
END $$;

-- Presença/Progresso Unificada
CREATE TABLE IF NOT EXISTS public.presencas_aula (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aula_id UUID REFERENCES public.aulas(id) ON DELETE CASCADE,
  etapa_id UUID REFERENCES public.etapas_jornada(id),
  aluno_id UUID REFERENCES public.profiles(id),
  checkin_at TIMESTAMPTZ DEFAULT now(),
  checkout_at TIMESTAMPTZ,
  responsavel_checkout_id UUID REFERENCES public.profiles(id),
  observacoes_seguranca TEXT,
  status TEXT DEFAULT 'presente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. SEGURANÇA E PERMISSÕES (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.liturgia_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencas_aula ENABLE ROW LEVEL SECURITY;

-- Políticas de Leitura
CREATE POLICY "Auth pode ler templates liturgia" ON public.liturgia_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar templates liturgia" ON public.liturgia_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auth pode ver salas" ON public.salas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar salas" ON public.salas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auth pode ver aulas" ON public.aulas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar aulas" ON public.aulas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Auth pode ver presencas aula" ON public.presencas_aula FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth pode registrar presenca" ON public.presencas_aula FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins podem gerenciar presencas" ON public.presencas_aula FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_liturgia_templates_updated_at BEFORE UPDATE ON public.liturgia_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_salas_updated_at BEFORE UPDATE ON public.salas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aulas_updated_at BEFORE UPDATE ON public.aulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();