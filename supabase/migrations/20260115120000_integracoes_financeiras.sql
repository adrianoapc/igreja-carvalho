-- Tabelas para configuracao de integracoes financeiras (agnostico por provedor)
CREATE TABLE IF NOT EXISTS public.integracoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais(id) ON DELETE SET NULL,
  cnpj TEXT NOT NULL,
  provedor TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integracoes_financeiras_igreja
  ON public.integracoes_financeiras (igreja_id);
CREATE INDEX IF NOT EXISTS idx_integracoes_financeiras_filial
  ON public.integracoes_financeiras (filial_id);
CREATE INDEX IF NOT EXISTS idx_integracoes_financeiras_provedor
  ON public.integracoes_financeiras (provedor);

CREATE TABLE IF NOT EXISTS public.integracoes_financeiras_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id UUID NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  pfx_blob BYTEA,
  pfx_password TEXT,
  client_id TEXT,
  client_secret TEXT,
  application_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integracoes_financeiras_secrets_integracao
  ON public.integracoes_financeiras_secrets (integracao_id);

COMMENT ON TABLE public.integracoes_financeiras IS
'Configuracao de integracoes financeiras por igreja/filial e provedor (agnostico).';

COMMENT ON TABLE public.integracoes_financeiras_secrets IS
'Secrets sensiveis das integracoes financeiras (armazenar criptografado).';

-- Enable RLS
ALTER TABLE public.integracoes_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracoes_financeiras_secrets ENABLE ROW LEVEL SECURITY;

-- Policies para integracoes_financeiras (admin/tesoureiro)
CREATE POLICY "Ver integracoes financeiras"
ON public.integracoes_financeiras FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND igreja_id = public.get_jwt_igreja_id()
);

CREATE POLICY "Inserir integracoes financeiras"
ON public.integracoes_financeiras FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND igreja_id = public.get_jwt_igreja_id()
);

CREATE POLICY "Atualizar integracoes financeiras"
ON public.integracoes_financeiras FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND igreja_id = public.get_jwt_igreja_id()
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND igreja_id = public.get_jwt_igreja_id()
);

CREATE POLICY "Deletar integracoes financeiras"
ON public.integracoes_financeiras FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND igreja_id = public.get_jwt_igreja_id()
);

-- Sem policies para secrets: acesso somente via service role (edge functions)
