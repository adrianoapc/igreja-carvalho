
ALTER TABLE public.integracoes_financeiras
  ADD COLUMN IF NOT EXISTS tipo_auth text NOT NULL DEFAULT 'token';

ALTER TABLE public.integracoes_financeiras
  DROP CONSTRAINT IF EXISTS integracoes_financeiras_tipo_auth_check;

ALTER TABLE public.integracoes_financeiras
  ADD CONSTRAINT integracoes_financeiras_tipo_auth_check
  CHECK (tipo_auth IN ('token','sftp'));

ALTER TABLE public.integracoes_financeiras_secrets
  ADD COLUMN IF NOT EXISTS sftp_host text,
  ADD COLUMN IF NOT EXISTS sftp_port text,
  ADD COLUMN IF NOT EXISTS sftp_username text,
  ADD COLUMN IF NOT EXISTS sftp_password text,
  ADD COLUMN IF NOT EXISTS sftp_path text;
