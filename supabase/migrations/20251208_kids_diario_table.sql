-- Criar tabela para Diário de Classe do Kids
CREATE TABLE IF NOT EXISTS public.kids_diario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crianca_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  culto_id UUID REFERENCES public.cultos(id) ON DELETE SET NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  professor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comportamento_tags TEXT[] DEFAULT '{}',
  necessidades_tags TEXT[] DEFAULT '{}',
  humor TEXT CHECK (humor IN ('feliz', 'triste', 'agitado', 'neutro', 'choroso', 'sonolento')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Constraint: apenas um diário por criança por culto (ou por data se culto for nulo)
CREATE UNIQUE INDEX idx_kids_diario_crianca_culto ON public.kids_diario(crianca_id, culto_id) 
  WHERE culto_id IS NOT NULL;

CREATE UNIQUE INDEX idx_kids_diario_crianca_data ON public.kids_diario(crianca_id, data) 
  WHERE culto_id IS NULL;

-- Índices para performance
CREATE INDEX idx_kids_diario_crianca ON public.kids_diario(crianca_id);
CREATE INDEX idx_kids_diario_data ON public.kids_diario(data);
CREATE INDEX idx_kids_diario_culto ON public.kids_diario(culto_id);

-- RLS
ALTER TABLE public.kids_diario ENABLE ROW LEVEL SECURITY;

-- Líderes podem gerenciar diários
CREATE POLICY "Lideres gerenciam diarios" ON public.kids_diario
  FOR ALL 
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'lider'::app_role) OR
    has_role(auth.uid(), 'secretario'::app_role)
  );

-- Pais podem ver diários dos próprios filhos
CREATE POLICY "Pais veem diarios dos filhos" ON public.kids_diario
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = kids_diario.crianca_id
      AND p.responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_kids_diario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kids_diario_updated_at
  BEFORE UPDATE ON public.kids_diario
  FOR EACH ROW
  EXECUTE FUNCTION update_kids_diario_updated_at();

-- View para facilitar consultas com dados joinados
CREATE OR REPLACE VIEW public.view_kids_diario AS
SELECT 
  kd.id,
  kd.crianca_id,
  kd.culto_id,
  kd.data,
  kd.professor_id,
  kd.comportamento_tags,
  kd.necessidades_tags,
  kd.humor,
  kd.observacoes,
  kd.created_at,
  kd.updated_at,
  crianca.nome AS crianca_nome,
  crianca.avatar_url AS crianca_avatar,
  crianca.data_nascimento AS crianca_nascimento,
  professor.nome AS professor_nome,
  culto.titulo AS culto_titulo,
  culto.data_culto AS culto_data
FROM public.kids_diario kd
JOIN public.profiles crianca ON crianca.id = kd.crianca_id
JOIN public.profiles professor ON professor.id = kd.professor_id
LEFT JOIN public.cultos culto ON culto.id = kd.culto_id;

COMMENT ON TABLE public.kids_diario IS 
  'Diário de classe do ministério Kids para observações comportamentais e recados para pais';

COMMENT ON COLUMN public.kids_diario.comportamento_tags IS 
  'Tags de comportamento: participou, orou, brincou, ajudou, atencioso, criativo, etc';

COMMENT ON COLUMN public.kids_diario.necessidades_tags IS 
  'Necessidades atendidas: banheiro, agua, lanche, descanso, atenção_especial, etc';

COMMENT ON COLUMN public.kids_diario.humor IS 
  'Estado emocional da criança durante o culto';
