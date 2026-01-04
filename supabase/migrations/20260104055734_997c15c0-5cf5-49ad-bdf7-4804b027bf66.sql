-- Corrigir funções JWT com search_path
CREATE OR REPLACE FUNCTION public.get_jwt_igreja_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'igreja_id'), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.get_jwt_filial_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.filial_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'filial_id'), '')::uuid
  );
$$;

-- Criar tabela de filiais
CREATE TABLE IF NOT EXISTS public.filiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_filiais_updated_at ON public.filiais;
CREATE TRIGGER update_filiais_updated_at
  BEFORE UPDATE ON public.filiais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS filiais_igreja_nome_unique
  ON public.filiais (igreja_id, nome);

-- RLS em filiais
ALTER TABLE public.filiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem ver filiais da igreja" ON public.filiais;
CREATE POLICY "Usuarios podem ver filiais da igreja"
  ON public.filiais
  FOR SELECT
  USING (igreja_id = public.get_jwt_igreja_id() OR public.get_jwt_igreja_id() IS NULL);

DROP POLICY IF EXISTS "Admin igreja gerencia filiais" ON public.filiais;
CREATE POLICY "Admin igreja gerencia filiais"
  ON public.filiais
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_igreja'::app_role)
  )
  WITH CHECK (
    (igreja_id = public.get_jwt_igreja_id() OR public.get_jwt_igreja_id() IS NULL)
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_igreja'::app_role)
    )
  );

-- Inserir filial padrão para cada igreja
INSERT INTO public.filiais (igreja_id, nome)
SELECT id, 'Matriz'
FROM public.igrejas
WHERE NOT EXISTS (
  SELECT 1
  FROM public.filiais fil
  WHERE fil.igreja_id = igrejas.id
);

-- Helper para filial padrão por igreja
CREATE OR REPLACE FUNCTION public.get_default_filial_id(_igreja_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM public.filiais
  WHERE igreja_id = _igreja_id
  ORDER BY created_at ASC
  LIMIT 1;
$$;