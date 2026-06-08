
ALTER TABLE public.profile_contatos
  DROP CONSTRAINT IF EXISTS profile_contatos_tipo_check;

ALTER TABLE public.profile_contatos
  ADD CONSTRAINT profile_contatos_tipo_check
  CHECK (tipo = ANY (ARRAY['telefone'::text, 'celular'::text, 'fixo'::text, 'email'::text, 'instagram'::text, 'outro'::text]));
