-- Create table for pending profile updates from external registration
CREATE TABLE public.alteracoes_perfil_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dados_novos JSONB NOT NULL,
  dados_antigos JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por UUID REFERENCES auth.users(id),
  campos_aprovados JSONB DEFAULT '{}',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alteracoes_perfil_pendentes ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can view/manage
CREATE POLICY "Admins can view pending changes"
ON public.alteracoes_perfil_pendentes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Admins can update pending changes"
ON public.alteracoes_perfil_pendentes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Edge function can insert pending changes"
ON public.alteracoes_perfil_pendentes
FOR INSERT
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_alteracoes_perfil_updated_at
BEFORE UPDATE ON public.alteracoes_perfil_pendentes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();