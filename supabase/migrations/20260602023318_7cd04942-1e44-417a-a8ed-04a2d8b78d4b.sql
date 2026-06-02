ALTER TABLE public.integracoes_financeiras_secrets
  ADD COLUMN IF NOT EXISTS pix_client_id text,
  ADD COLUMN IF NOT EXISTS pix_client_secret text;

COMMENT ON COLUMN public.integracoes_financeiras_secrets.client_id IS 'Client ID Open Banking (Cash Management) - criptografado';
COMMENT ON COLUMN public.integracoes_financeiras_secrets.client_secret IS 'Client Secret Open Banking (Cash Management) - criptografado';
COMMENT ON COLUMN public.integracoes_financeiras_secrets.pix_client_id IS 'Client ID PIX (aplicação PIX no portal Santander Developers) - criptografado';
COMMENT ON COLUMN public.integracoes_financeiras_secrets.pix_client_secret IS 'Client Secret PIX - criptografado';