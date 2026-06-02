ALTER TABLE public.integracoes_financeiras_secrets
  DROP COLUMN IF EXISTS sftp_host,
  DROP COLUMN IF EXISTS sftp_port,
  DROP COLUMN IF EXISTS sftp_username,
  DROP COLUMN IF EXISTS sftp_password,
  DROP COLUMN IF EXISTS sftp_path;