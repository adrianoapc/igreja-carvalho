-- Criar tabela de relacionamentos familiares
CREATE TABLE public.familias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  familiar_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome_familiar TEXT,
  tipo_parentesco TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar índices para melhor performance
CREATE INDEX idx_familias_pessoa_id ON public.familias(pessoa_id);
CREATE INDEX idx_familias_familiar_id ON public.familias(familiar_id);

-- Habilitar RLS
ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem ver todos os relacionamentos familiares"
ON public.familias
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar relacionamentos familiares"
ON public.familias
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar relacionamentos familiares"
ON public.familias
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar relacionamentos familiares"
ON public.familias
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Membros podem ver seus próprios relacionamentos"
ON public.familias
FOR SELECT
USING (
  pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR familiar_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_familias_updated_at
BEFORE UPDATE ON public.familias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();