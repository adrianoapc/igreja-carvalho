CREATE TABLE public.presencas_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo_registro TEXT DEFAULT 'checkin_manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(culto_id, pessoa_id)
);

ALTER TABLE public.presencas_culto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lideres gerenciam presenca" ON public.presencas_culto
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role));