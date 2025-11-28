-- Criar tabela de funções/cargos na igreja
CREATE TABLE IF NOT EXISTS public.funcoes_igreja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de relacionamento entre membros e funções
CREATE TABLE IF NOT EXISTS public.membro_funcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  funcao_id UUID NOT NULL REFERENCES public.funcoes_igreja(id) ON DELETE CASCADE,
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(membro_id, funcao_id)
);

-- Habilitar RLS
ALTER TABLE public.funcoes_igreja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membro_funcoes ENABLE ROW LEVEL SECURITY;

-- Políticas para funcoes_igreja
CREATE POLICY "Todos podem ver funções ativas"
ON public.funcoes_igreja
FOR SELECT
TO authenticated
USING (ativo = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar funções"
ON public.funcoes_igreja
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar funções"
ON public.funcoes_igreja
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar funções"
ON public.funcoes_igreja
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Políticas para membro_funcoes
CREATE POLICY "Admins podem ver todas as atribuições"
ON public.membro_funcoes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Membros podem ver suas próprias funções"
ON public.membro_funcoes
FOR SELECT
TO authenticated
USING (membro_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem criar atribuições"
ON public.membro_funcoes
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar atribuições"
ON public.membro_funcoes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar atribuições"
ON public.membro_funcoes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_funcoes_igreja_updated_at
  BEFORE UPDATE ON public.funcoes_igreja
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_membro_funcoes_updated_at
  BEFORE UPDATE ON public.membro_funcoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir algumas funções padrão
INSERT INTO public.funcoes_igreja (nome, descricao) VALUES
  ('Pastor', 'Líder espiritual da igreja'),
  ('Diácono', 'Servidor na igreja'),
  ('Presbítero', 'Líder e conselheiro'),
  ('Professor', 'Professor da Escola Bíblica'),
  ('Líder de Célula', 'Responsável por célula'),
  ('Músico', 'Ministério de louvor'),
  ('Intercessor', 'Ministério de oração'),
  ('Tesoureiro', 'Gestão financeira'),
  ('Secretário', 'Gestão administrativa')
ON CONFLICT (nome) DO NOTHING;