-- Criar enum para categorias de testemunhos
CREATE TYPE public.categoria_testemunho AS ENUM (
  'espiritual',
  'casamento',
  'familia',
  'saude',
  'trabalho',
  'financeiro',
  'ministerial',
  'outro'
);

-- Criar enum para status de testemunhos
CREATE TYPE public.status_testemunho AS ENUM (
  'aberto',
  'publico',
  'arquivado'
);

-- Criar tabela de testemunhos
CREATE TABLE public.testemunhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  categoria categoria_testemunho NOT NULL DEFAULT 'outro',
  status status_testemunho NOT NULL DEFAULT 'aberto',
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  publicar BOOLEAN NOT NULL DEFAULT false,
  data_publicacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.testemunhos ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem ver todos os testemunhos
CREATE POLICY "Admins podem ver todos os testemunhos"
ON public.testemunhos
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Autores podem ver seus próprios testemunhos
CREATE POLICY "Autores podem ver seus próprios testemunhos"
ON public.testemunhos
FOR SELECT
USING (
  autor_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Policy: Todos podem ver testemunhos públicos publicados
CREATE POLICY "Todos podem ver testemunhos públicos publicados"
ON public.testemunhos
FOR SELECT
USING (status = 'publico' AND publicar = true);

-- Policy: Membros podem criar testemunhos
CREATE POLICY "Membros podem criar testemunhos"
ON public.testemunhos
FOR INSERT
WITH CHECK (
  is_member(auth.uid()) AND
  autor_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Policy: Autores podem atualizar seus próprios testemunhos
CREATE POLICY "Autores podem atualizar seus próprios testemunhos"
ON public.testemunhos
FOR UPDATE
USING (
  autor_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Policy: Admins podem atualizar qualquer testemunho
CREATE POLICY "Admins podem atualizar qualquer testemunho"
ON public.testemunhos
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins podem deletar testemunhos
CREATE POLICY "Admins podem deletar testemunhos"
ON public.testemunhos
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_testemunhos_updated_at
BEFORE UPDATE ON public.testemunhos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX idx_testemunhos_status ON public.testemunhos(status);
CREATE INDEX idx_testemunhos_categoria ON public.testemunhos(categoria);
CREATE INDEX idx_testemunhos_autor_id ON public.testemunhos(autor_id);
CREATE INDEX idx_testemunhos_publicar ON public.testemunhos(publicar) WHERE publicar = true;
CREATE INDEX idx_testemunhos_created_at ON public.testemunhos(created_at DESC);