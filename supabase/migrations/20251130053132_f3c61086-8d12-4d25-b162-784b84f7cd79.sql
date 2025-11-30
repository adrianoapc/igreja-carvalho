-- Adicionar coluna responsavel_externo na tabela liturgia_culto
ALTER TABLE public.liturgia_culto
ADD COLUMN responsavel_externo text;

COMMENT ON COLUMN public.liturgia_culto.responsavel_externo IS 'Nome do responsável externo (não membro) pelo item da liturgia';