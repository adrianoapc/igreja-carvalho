-- Adicionar campos de solista e ministro na tabela cancoes_culto
ALTER TABLE public.cancoes_culto 
ADD COLUMN solista_id UUID REFERENCES public.profiles(id),
ADD COLUMN ministro_id UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.cancoes_culto.solista_id IS 'Membro responsável pelo solo';
COMMENT ON COLUMN public.cancoes_culto.ministro_id IS 'Membro responsável por ministrar a canção';