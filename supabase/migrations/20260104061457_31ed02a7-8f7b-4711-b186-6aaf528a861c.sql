-- Parte 2: Expandir tabela igrejas + Criar tabelas de métricas e onboarding

-- 2. Expandir tabela igrejas com campos de gestão
ALTER TABLE public.igrejas 
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_responsavel_id UUID;

-- Atualizar igrejas existentes para status ativo
UPDATE public.igrejas SET status = 'ativo' WHERE status IS NULL OR status = '';

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_igrejas_status ON public.igrejas(status);

-- 3. Tabela de métricas de uso por tenant
CREATE TABLE IF NOT EXISTS public.tenant_metricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  data_referencia DATE NOT NULL,
  total_membros INTEGER DEFAULT 0,
  membros_ativos INTEGER DEFAULT 0,
  total_eventos INTEGER DEFAULT 0,
  total_transacoes INTEGER DEFAULT 0,
  valor_transacoes NUMERIC(15,2) DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  total_midias INTEGER DEFAULT 0,
  total_chamadas_api INTEGER DEFAULT 0,
  total_erros_api INTEGER DEFAULT 0,
  latencia_media_ms INTEGER DEFAULT 0,
  total_checkins INTEGER DEFAULT 0,
  total_pedidos_oracao INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(igreja_id, data_referencia)
);

DROP TRIGGER IF EXISTS update_tenant_metricas_updated_at ON public.tenant_metricas;
CREATE TRIGGER update_tenant_metricas_updated_at
  BEFORE UPDATE ON public.tenant_metricas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tenant_metricas_igreja_data 
  ON public.tenant_metricas(igreja_id, data_referencia DESC);

-- 4. Tabela de solicitações de onboarding
CREATE TABLE IF NOT EXISTS public.onboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_igreja TEXT NOT NULL,
  cnpj TEXT,
  email TEXT NOT NULL,
  telefone TEXT,
  nome_responsavel TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  processado_por UUID REFERENCES auth.users(id),
  processado_em TIMESTAMP WITH TIME ZONE,
  igreja_id UUID REFERENCES public.igrejas(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DROP TRIGGER IF EXISTS update_onboarding_requests_updated_at ON public.onboarding_requests;
CREATE TRIGGER update_onboarding_requests_updated_at
  BEFORE UPDATE ON public.onboarding_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_onboarding_status ON public.onboarding_requests(status);