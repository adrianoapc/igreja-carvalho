-- 1. Classificar a Jornada
-- Adiciona o tipo para sabermos se mostramos o Player (Curso) ou o Kanban (Processo) como visão principal
ALTER TABLE jornadas 
ADD COLUMN IF NOT EXISTS tipo_jornada TEXT DEFAULT 'auto_instrucional' 
CHECK (tipo_jornada IN ('auto_instrucional', 'processo_acompanhado', 'hibrido'));

-- 2. Enriquecer a Etapa (Onde fica a configuração do "Soft Lock")
ALTER TABLE etapas_jornada
ADD COLUMN IF NOT EXISTS conteudo_tipo TEXT DEFAULT 'texto' CHECK (conteudo_tipo IN ('texto', 'video', 'quiz', 'tarefa', 'reuniao')),
ADD COLUMN IF NOT EXISTS quiz_config JSONB,
ADD COLUMN IF NOT EXISTS check_automatico BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS duracao_estimada_minutos INT;

-- 3. Tabela de Respostas de Quiz (Para o histórico do aluno)
CREATE TABLE IF NOT EXISTS respostas_quiz (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id UUID REFERENCES inscricoes_jornada(id) ON DELETE CASCADE,
  etapa_id UUID REFERENCES etapas_jornada(id) ON DELETE CASCADE,
  respostas JSONB NOT NULL,
  nota_obtida NUMERIC(5,2),
  aprovado BOOLEAN DEFAULT false,
  tentativa_numero INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para Respostas
ALTER TABLE respostas_quiz ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aluno vê suas respostas" ON respostas_quiz 
FOR SELECT USING (
  auth.uid() IN (
    SELECT p.user_id FROM inscricoes_jornada ij
    JOIN profiles p ON ij.pessoa_id = p.id
    WHERE ij.id = inscricao_id
  )
);

CREATE POLICY "Aluno insere respostas" ON respostas_quiz 
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT p.user_id FROM inscricoes_jornada ij
    JOIN profiles p ON ij.pessoa_id = p.id
    WHERE ij.id = inscricao_id
  )
);

CREATE POLICY "Admin gerencia respostas" ON respostas_quiz
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));