-- Tornar culto_id opcional na tabela midias
-- Isso permite criar mídias independentes de cultos específicos
ALTER TABLE public.midias
ALTER COLUMN culto_id DROP NOT NULL;

COMMENT ON COLUMN public.midias.culto_id IS 'ID do culto relacionado (opcional - mídias podem existir independentemente de cultos)';