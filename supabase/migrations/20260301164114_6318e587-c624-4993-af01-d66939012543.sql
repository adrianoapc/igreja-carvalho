
-- Tabela para armazenar OTPs de verificação de senha
CREATE TABLE public.otp_verificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  codigo varchar(6) NOT NULL,
  tipo varchar(20) NOT NULL,
  telefone varchar(20),
  igreja_id uuid,
  expira_em timestamptz NOT NULL,
  usado boolean DEFAULT false,
  tentativas int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS: somente service_role acessa (via Edge Functions)
ALTER TABLE public.otp_verificacao ENABLE ROW LEVEL SECURITY;

-- Índices para consultas frequentes
CREATE INDEX idx_otp_verificacao_telefone_codigo ON public.otp_verificacao (telefone, codigo) WHERE usado = false;
CREATE INDEX idx_otp_verificacao_profile_id ON public.otp_verificacao (profile_id);
