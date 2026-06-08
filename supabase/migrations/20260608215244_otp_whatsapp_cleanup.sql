-- Índice extra para acelerar busca por expiração (usada em send-otp e verify-otp)
CREATE INDEX IF NOT EXISTS idx_otp_verificacao_expira_em
  ON public.otp_verificacao (expira_em)
  WHERE usado = false;

-- Função para limpar OTPs expirados (pode ser agendada via pg_cron ou cron job)
CREATE OR REPLACE FUNCTION public.limpar_otps_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deletados integer;
BEGIN
  DELETE FROM public.otp_verificacao
  WHERE expira_em < now() - interval '1 hour'
     OR (usado = true AND created_at < now() - interval '24 hours');

  GET DIAGNOSTICS deletados = ROW_COUNT;
  RETURN deletados;
END;
$$;
