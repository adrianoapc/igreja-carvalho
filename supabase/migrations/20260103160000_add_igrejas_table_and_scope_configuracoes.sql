-- Criar tabela de igrejas (tenant root)
CREATE TABLE IF NOT EXISTS public.igrejas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_igrejas_updated_at ON public.igrejas;
CREATE TRIGGER update_igrejas_updated_at
  BEFORE UPDATE ON public.igrejas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir igreja padrão
INSERT INTO public.igrejas (nome)
VALUES ('Igreja Padrão');

-- Adicionar coluna igreja_id nas configurações
ALTER TABLE public.configuracoes_igreja
  ADD COLUMN IF NOT EXISTS igreja_id UUID;

-- Migrar configuração existente para a igreja padrão
WITH igreja_padrao AS (
  SELECT id FROM public.igrejas ORDER BY created_at ASC LIMIT 1
)
UPDATE public.configuracoes_igreja
SET igreja_id = (SELECT id FROM igreja_padrao)
WHERE igreja_id IS NULL;

-- Garantir restrições
ALTER TABLE public.configuracoes_igreja
  ALTER COLUMN igreja_id SET NOT NULL;

ALTER TABLE public.configuracoes_igreja
  ADD CONSTRAINT configuracoes_igreja_igreja_id_fkey
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_igreja_igreja_id_key
  ON public.configuracoes_igreja (igreja_id);

-- Habilitar RLS em igrejas
ALTER TABLE public.igrejas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para igrejas
DROP POLICY IF EXISTS "Igreja pode ser vista pelo tenant" ON public.igrejas;
CREATE POLICY "Igreja pode ser vista pelo tenant"
  ON public.igrejas
  FOR SELECT
  USING (
    id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "Admins podem atualizar igreja" ON public.igrejas;
CREATE POLICY "Admins podem atualizar igreja"
  ON public.igrejas
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin')
    AND id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  )
  WITH CHECK (
    id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  );

-- Atualizar políticas RLS em configuracoes_igreja
DROP POLICY IF EXISTS "Todos podem ver configurações" ON public.configuracoes_igreja;
DROP POLICY IF EXISTS "Admins podem atualizar configurações" ON public.configuracoes_igreja;

CREATE POLICY "Igreja pode ver configuracoes"
  ON public.configuracoes_igreja
  FOR SELECT
  USING (
    igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  );

CREATE POLICY "Admins podem atualizar configuracoes"
  ON public.configuracoes_igreja
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin')
    AND igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  )
  WITH CHECK (
    igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  );
