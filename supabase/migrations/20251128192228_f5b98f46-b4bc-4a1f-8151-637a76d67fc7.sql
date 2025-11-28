-- Adicionar campos de controle de visitante na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS aceitou_jesus boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deseja_contato boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS recebeu_brinde boolean DEFAULT false;

-- Criar tabela de contatos com visitantes
CREATE TABLE IF NOT EXISTS public.visitante_contatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitante_id UUID NOT NULL,
  data_contato TIMESTAMP WITH TIME ZONE NOT NULL,
  membro_responsavel_id UUID NOT NULL,
  observacoes TEXT,
  tipo_contato TEXT DEFAULT 'telefonico',
  status TEXT DEFAULT 'agendado',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_visitante FOREIGN KEY (visitante_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_membro_responsavel FOREIGN KEY (membro_responsavel_id) REFERENCES public.profiles(user_id) ON DELETE RESTRICT
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_visitante_contatos_visitante ON public.visitante_contatos(visitante_id);
CREATE INDEX IF NOT EXISTS idx_visitante_contatos_membro ON public.visitante_contatos(membro_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_visitante_contatos_data ON public.visitante_contatos(data_contato);
CREATE INDEX IF NOT EXISTS idx_visitante_contatos_status ON public.visitante_contatos(status);

-- Habilitar RLS
ALTER TABLE public.visitante_contatos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para visitante_contatos
CREATE POLICY "Admins podem ver todos os contatos"
ON public.visitante_contatos
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem criar contatos"
ON public.visitante_contatos
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar contatos"
ON public.visitante_contatos
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar contatos"
ON public.visitante_contatos
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros responsáveis podem ver seus contatos"
ON public.visitante_contatos
FOR SELECT
USING (membro_responsavel_id = auth.uid());

CREATE POLICY "Membros responsáveis podem atualizar seus contatos"
ON public.visitante_contatos
FOR UPDATE
USING (membro_responsavel_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_visitante_contatos_updated_at
BEFORE UPDATE ON public.visitante_contatos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.visitante_contatos IS 'Registra agendamentos e histórico de contatos com visitantes';
COMMENT ON COLUMN public.visitante_contatos.tipo_contato IS 'Tipo do contato: telefonico, presencial, whatsapp, email';
COMMENT ON COLUMN public.visitante_contatos.status IS 'Status do contato: agendado, realizado, cancelado';