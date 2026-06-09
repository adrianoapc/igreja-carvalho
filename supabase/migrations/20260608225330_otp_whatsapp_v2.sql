-- Suporte a OTP via WhatsApp Cloud API (Meta)
-- Adiciona hash do código, wamid, meta_error e índice para rate-limiting.
-- A coluna `codigo` (varchar 6) continua intacta para não quebrar verificar-otp-senha.

ALTER TABLE public.otp_verificacao
  ADD COLUMN IF NOT EXISTS codigo_hash TEXT,          -- SHA-256 hex do código (novo fluxo)
  ADD COLUMN IF NOT EXISTS wamid       TEXT,          -- message id retornado pela Meta
  ADD COLUMN IF NOT EXISTS meta_error  TEXT;          -- código/mensagem de erro da Meta

-- Índice para rate-limiting: contar envios por telefone nos últimos N minutos
CREATE INDEX IF NOT EXISTS idx_otp_rate_limit
  ON public.otp_verificacao (telefone, created_at DESC)
  WHERE tipo = 'whatsapp';

-- Índice de busca por hash (verify-otp)
CREATE INDEX IF NOT EXISTS idx_otp_codigo_hash
  ON public.otp_verificacao (telefone, codigo_hash)
  WHERE usado = false AND codigo_hash IS NOT NULL;

-- Remove migration anterior de limpeza (foi substituída por esta)
-- (o índice idx_otp_verificacao_expira_em e a função limpar_otps_expirados
--  continuam válidos da migration anterior)
