-- 1. Criar tabela de candidatos a voluntário
CREATE TABLE IF NOT EXISTS public.candidatos_voluntario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nome_contato TEXT NOT NULL,
  telefone_contato TEXT,
  email_contato TEXT,
  ministerio TEXT NOT NULL,
  disponibilidade TEXT NOT NULL,
  experiencia TEXT NOT NULL,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'aprovado', 'em_trilha', 'rejeitado')),
  trilha_requerida_id UUID REFERENCES jornadas(id),
  avaliado_por UUID REFERENCES profiles(id),
  data_avaliacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE public.candidatos_voluntario ENABLE ROW LEVEL SECURITY;

-- Admins e líderes podem ver todos
CREATE POLICY "Admins podem gerenciar candidatos"
ON public.candidatos_voluntario
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'lider'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'lider'::app_role));

-- Qualquer pessoa autenticada pode criar candidatura
CREATE POLICY "Autenticados podem criar candidatura"
ON public.candidatos_voluntario
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Usuário pode ver suas próprias candidaturas
CREATE POLICY "Ver própria candidatura"
ON public.candidatos_voluntario
FOR SELECT
TO authenticated
USING (
  pessoa_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Trigger para updated_at
CREATE TRIGGER update_candidatos_voluntario_updated_at
BEFORE UPDATE ON public.candidatos_voluntario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Função para notificar líderes sobre novo candidato
CREATE OR REPLACE FUNCTION public.notify_new_candidato_voluntario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lider_ids UUID[];
BEGIN
  -- Notificar todos admins e líderes
  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  SELECT 
    ur.user_id,
    'Novo Candidato a Voluntário',
    format('Novo candidato para %s: %s', NEW.ministerio, NEW.nome_contato),
    'novo_candidato_voluntario',
    jsonb_build_object(
      'candidato_id', NEW.id,
      'ministerio', NEW.ministerio,
      'nome_contato', NEW.nome_contato,
      'disponibilidade', NEW.disponibilidade
    )
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'lider');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_candidato
AFTER INSERT ON public.candidatos_voluntario
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_candidato_voluntario();

-- 3. Inserir as 6 jornadas (trilhas) de voluntariado
INSERT INTO public.jornadas (titulo, descricao, tipo_jornada, ativo, exibir_portal)
VALUES 
  ('Trilha de Integração', 'Jornada inicial para novos frequentadores conhecerem a visão, missão e valores da igreja antes de servir.', 'auto_instrucional', true, true),
  ('Trilha Kids', 'Capacitação para servir no ministério infantil com segurança, pedagogia cristã e acolhimento.', 'auto_instrucional', true, true),
  ('Trilha de Louvor', 'Formação para músicos e vocalistas, incluindo técnica, repertório e postura ministerial.', 'auto_instrucional', true, true),
  ('Trilha de Mídia', 'Treinamento em som, projeção, transmissão e comunicação visual para eventos.', 'auto_instrucional', true, true),
  ('Trilha de Intercessão', 'Fundamentação bíblica e prática para o ministério de oração e intercessão.', 'auto_instrucional', true, true),
  ('Trilha de Recepção', 'Preparo para acolhimento de visitantes e integração de novos membros.', 'auto_instrucional', true, true)
ON CONFLICT DO NOTHING;

-- 4. Inserir etapas básicas para cada trilha
DO $$
DECLARE
  v_jornada_id UUID;
BEGIN
  -- Trilha de Integração
  SELECT id INTO v_jornada_id FROM jornadas WHERE titulo = 'Trilha de Integração' LIMIT 1;
  IF v_jornada_id IS NOT NULL THEN
    INSERT INTO etapas_jornada (jornada_id, titulo, ordem, tipo_conteudo, conteudo_texto)
    VALUES 
      (v_jornada_id, 'Bem-vindo à nossa família', 1, 'texto', 'Conheça a história e visão da nossa igreja.'),
      (v_jornada_id, 'Nossa fé e valores', 2, 'texto', 'Entenda os fundamentos bíblicos que nos guiam.'),
      (v_jornada_id, 'Como participar', 3, 'texto', 'Descubra as formas de se envolver e crescer conosco.');
  END IF;

  -- Trilha Kids
  SELECT id INTO v_jornada_id FROM jornadas WHERE titulo = 'Trilha Kids' LIMIT 1;
  IF v_jornada_id IS NOT NULL THEN
    INSERT INTO etapas_jornada (jornada_id, titulo, ordem, tipo_conteudo, conteudo_texto)
    VALUES 
      (v_jornada_id, 'Fundamentos do ministério infantil', 1, 'texto', 'Por que o ministério com crianças é importante.'),
      (v_jornada_id, 'Segurança e proteção', 2, 'texto', 'Protocolos de segurança para servir com crianças.'),
      (v_jornada_id, 'Técnicas de ensino', 3, 'texto', 'Como ensinar verdades bíblicas de forma criativa.');
  END IF;

  -- Trilha de Louvor
  SELECT id INTO v_jornada_id FROM jornadas WHERE titulo = 'Trilha de Louvor' LIMIT 1;
  IF v_jornada_id IS NOT NULL THEN
    INSERT INTO etapas_jornada (jornada_id, titulo, ordem, tipo_conteudo, conteudo_texto)
    VALUES 
      (v_jornada_id, 'Chamado para adoração', 1, 'texto', 'O propósito do ministério de louvor na igreja.'),
      (v_jornada_id, 'Postura e atitude', 2, 'texto', 'Vida espiritual e compromisso do adorador.'),
      (v_jornada_id, 'Aspectos práticos', 3, 'texto', 'Ensaios, repertório e dinâmica de equipe.');
  END IF;

  -- Trilha de Mídia
  SELECT id INTO v_jornada_id FROM jornadas WHERE titulo = 'Trilha de Mídia' LIMIT 1;
  IF v_jornada_id IS NOT NULL THEN
    INSERT INTO etapas_jornada (jornada_id, titulo, ordem, tipo_conteudo, conteudo_texto)
    VALUES 
      (v_jornada_id, 'Visão geral de mídia', 1, 'texto', 'O papel da comunicação visual e sonora na igreja.'),
      (v_jornada_id, 'Equipamentos e software', 2, 'texto', 'Conhecendo as ferramentas que utilizamos.'),
      (v_jornada_id, 'Operação em cultos', 3, 'texto', 'Fluxo de trabalho durante os eventos.');
  END IF;

  -- Trilha de Intercessão
  SELECT id INTO v_jornada_id FROM jornadas WHERE titulo = 'Trilha de Intercessão' LIMIT 1;
  IF v_jornada_id IS NOT NULL THEN
    INSERT INTO etapas_jornada (jornada_id, titulo, ordem, tipo_conteudo, conteudo_texto)
    VALUES 
      (v_jornada_id, 'Fundamentos da oração', 1, 'texto', 'O que a Bíblia ensina sobre intercessão.'),
      (v_jornada_id, 'Vida de oração', 2, 'texto', 'Desenvolvendo disciplina e intimidade com Deus.'),
      (v_jornada_id, 'Intercessão na prática', 3, 'texto', 'Como interceder de forma eficaz pela igreja.');
  END IF;

  -- Trilha de Recepção
  SELECT id INTO v_jornada_id FROM jornadas WHERE titulo = 'Trilha de Recepção' LIMIT 1;
  IF v_jornada_id IS NOT NULL THEN
    INSERT INTO etapas_jornada (jornada_id, titulo, ordem, tipo_conteudo, conteudo_texto)
    VALUES 
      (v_jornada_id, 'A arte de acolher', 1, 'texto', 'Por que o primeiro contato é tão importante.'),
      (v_jornada_id, 'Comunicação eficaz', 2, 'texto', 'Técnicas de abordagem e escuta ativa.'),
      (v_jornada_id, 'Fluxo de recepção', 3, 'texto', 'O passo a passo do acolhimento nos cultos.');
  END IF;
END $$;