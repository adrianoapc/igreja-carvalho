-- =============================================================================
-- INTEGRAÇÃO DE VOLUNTÁRIOS - FLUXO COMPLETO
-- Tabelas: testes_ministerio, integracao_voluntario, resultados_teste
-- =============================================================================

-- 1. Tabela de Testes por Ministério (criada primeiro por causa da FK)
CREATE TABLE IF NOT EXISTS public.testes_ministerio (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id uuid NOT NULL REFERENCES times(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL CHECK (tipo IN ('pratico', 'escrito', 'entrevista', 'hibrido')),
  conteudo_json jsonb DEFAULT '{}'::jsonb,
  pontuacao_minima_aprovacao numeric(5,2) DEFAULT 70.00,
  ativo boolean DEFAULT true,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_by uuid REFERENCES profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teste_ministerio ON testes_ministerio(time_id);
CREATE INDEX IF NOT EXISTS idx_teste_ativo ON testes_ministerio(ativo);
CREATE INDEX IF NOT EXISTS idx_teste_igreja ON testes_ministerio(igreja_id);

-- 2. Tabela de Integração - Rastreia progresso do candidato
CREATE TABLE IF NOT EXISTS public.integracao_voluntario (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidato_id uuid NOT NULL REFERENCES candidatos_voluntario(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  jornada_id uuid REFERENCES jornadas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'entrevista'::text CHECK (
    status IN ('entrevista', 'trilha', 'mentoria', 'teste', 'ativo', 'rejeitado')
  ),
  percentual_jornada integer DEFAULT 0 CHECK (percentual_jornada >= 0 AND percentual_jornada <= 100),
  data_jornada_iniciada timestamp with time zone,
  data_jornada_concluida timestamp with time zone,
  data_conclusao_esperada timestamp with time zone,
  teste_id uuid REFERENCES testes_ministerio(id) ON DELETE SET NULL,
  data_teste_agendada timestamp with time zone,
  resultado_teste text CHECK (resultado_teste IS NULL OR resultado_teste IN ('aprovado', 'reprovado', 'pendente')),
  pontuacao_teste numeric(5,2),
  data_resultado_teste timestamp with time zone,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integracao_candidato ON integracao_voluntario(candidato_id);
CREATE INDEX IF NOT EXISTS idx_integracao_mentor ON integracao_voluntario(mentor_id);
CREATE INDEX IF NOT EXISTS idx_integracao_status ON integracao_voluntario(status);
CREATE INDEX IF NOT EXISTS idx_integracao_igreja ON integracao_voluntario(igreja_id);

-- 3. Tabela de Resultados de Testes
CREATE TABLE IF NOT EXISTS public.resultados_teste (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integracao_id uuid NOT NULL REFERENCES integracao_voluntario(id) ON DELETE CASCADE,
  teste_id uuid NOT NULL REFERENCES testes_ministerio(id) ON DELETE RESTRICT,
  candidato_id uuid NOT NULL REFERENCES candidatos_voluntario(id) ON DELETE CASCADE,
  resposta_json jsonb DEFAULT '{}'::jsonb,
  pontuacao_total numeric(5,2),
  resultado text NOT NULL CHECK (resultado IN ('aprovado', 'reprovado')),
  feedback text,
  avaliado_por uuid REFERENCES profiles(id),
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resultado_integracao ON resultados_teste(integracao_id);
CREATE INDEX IF NOT EXISTS idx_resultado_teste ON resultados_teste(teste_id);
CREATE INDEX IF NOT EXISTS idx_resultado_candidato ON resultados_teste(candidato_id);
CREATE INDEX IF NOT EXISTS idx_resultado_resultado ON resultados_teste(resultado);
CREATE INDEX IF NOT EXISTS idx_resultado_igreja ON resultados_teste(igreja_id);

-- =============================================================================
-- RLS POLICIES (usando has_role() para evitar recursão)
-- =============================================================================

ALTER TABLE integracao_voluntario ENABLE ROW LEVEL SECURITY;
ALTER TABLE testes_ministerio ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_teste ENABLE ROW LEVEL SECURITY;

-- integracao_voluntario: Mentores veem candidatos que mentoram, admin/lider veem todos
CREATE POLICY "Mentores e admin veem integrações" ON integracao_voluntario
FOR SELECT USING (
  mentor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'lider'::app_role)
);

CREATE POLICY "Admin e lider gerenciam integrações" ON integracao_voluntario
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'lider'::app_role)
);

-- testes_ministerio: Todos autenticados leem testes ativos, admin gerencia
CREATE POLICY "Testes ativos são públicos" ON testes_ministerio
FOR SELECT USING (ativo = true);

CREATE POLICY "Admin gerencia testes" ON testes_ministerio
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'lider'::app_role)
);

-- resultados_teste: Candidatos veem próprios, mentores veem de seus candidatos
CREATE POLICY "Candidatos e mentores veem resultados" ON resultados_teste
FOR SELECT USING (
  candidato_id IN (
    SELECT id FROM candidatos_voluntario WHERE pessoa_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR
  EXISTS (
    SELECT 1 FROM integracao_voluntario 
    WHERE id = integracao_id 
    AND mentor_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'lider'::app_role)
);

CREATE POLICY "Admin e lider gerenciam resultados" ON resultados_teste
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'lider'::app_role)
);

-- =============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =============================================================================

COMMENT ON TABLE integracao_voluntario IS 'Rastreia o fluxo de integração de candidatos: entrevista → trilha → mentoria → teste → ativo';
COMMENT ON COLUMN integracao_voluntario.mentor_id IS 'Líder, sublíder ou membro sênior responsável pelo mentoring';
COMMENT ON COLUMN integracao_voluntario.percentual_jornada IS 'Progresso na trilha de formação (0-100%)';
COMMENT ON COLUMN integracao_voluntario.data_conclusao_esperada IS 'Data da jornada + 15 dias';

COMMENT ON TABLE testes_ministerio IS 'Catálogo de testes/audições para cada ministério';
COMMENT ON COLUMN testes_ministerio.tipo IS 'pratico (audição), escrito (prova), entrevista, ou híbrido';
COMMENT ON COLUMN testes_ministerio.conteudo_json IS 'Perguntas, critérios e configuração do teste em JSON';
COMMENT ON COLUMN testes_ministerio.pontuacao_minima_aprovacao IS 'Nota mínima para aprovação (ex: 70)';

COMMENT ON TABLE resultados_teste IS 'Respostas e pontuação do candidato no teste';
COMMENT ON COLUMN resultados_teste.resposta_json IS 'Respostas às perguntas do teste em JSON';
COMMENT ON COLUMN resultados_teste.avaliado_por IS 'Perfil do mentor/admin que corrigiu o teste';