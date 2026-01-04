-- Criar tabela de webhooks/integrações por igreja
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  url TEXT,
  secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhooks_igreja_id_tipo_key
  ON public.webhooks (igreja_id, tipo);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_webhooks_updated_at ON public.webhooks;
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas RLS
DROP POLICY IF EXISTS "Igreja pode ver webhooks" ON public.webhooks;
CREATE POLICY "Igreja pode ver webhooks"
  ON public.webhooks
  FOR SELECT
  USING (
    igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "Admins podem inserir webhooks" ON public.webhooks;
CREATE POLICY "Admins podem inserir webhooks"
  ON public.webhooks
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "Admins podem atualizar webhooks" ON public.webhooks;
CREATE POLICY "Admins podem atualizar webhooks"
  ON public.webhooks
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin')
    AND igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  )
  WITH CHECK (
    igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "Admins podem remover webhooks" ON public.webhooks;
CREATE POLICY "Admins podem remover webhooks"
  ON public.webhooks
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin')
    AND igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
  );

-- Migrar webhook Make de liturgia
INSERT INTO public.webhooks (igreja_id, tipo, url, secret, enabled)
SELECT igreja_id,
       'make_liturgia',
       webhook_make_liturgia,
       NULL,
       true
FROM public.configuracoes_igreja
WHERE webhook_make_liturgia IS NOT NULL
  AND webhook_make_liturgia <> ''
ON CONFLICT (igreja_id, tipo) DO UPDATE
SET url = EXCLUDED.url,
    enabled = EXCLUDED.enabled;

-- Migrar configuração de WhatsApp
INSERT INTO public.webhooks (igreja_id, tipo, url, secret, enabled)
SELECT igreja_id,
       CASE whatsapp_provider
         WHEN 'meta_official' THEN 'whatsapp_meta'
         WHEN 'evolution_api' THEN 'whatsapp_evolution'
         ELSE 'whatsapp_make'
       END AS tipo,
       CASE
         WHEN whatsapp_provider IN ('meta_official', 'evolution_api') THEN whatsapp_instance_id
         ELSE NULL
       END AS url,
       CASE
         WHEN whatsapp_provider IN ('meta_official', 'evolution_api') THEN whatsapp_token
         ELSE NULL
       END AS secret,
       whatsapp_provider IS NOT NULL AND whatsapp_provider <> 'nenhum'
FROM public.configuracoes_igreja
WHERE whatsapp_provider IS NOT NULL
ON CONFLICT (igreja_id, tipo) DO UPDATE
SET url = EXCLUDED.url,
    secret = EXCLUDED.secret,
    enabled = EXCLUDED.enabled;

-- Remover colunas antigas de configuração
ALTER TABLE public.configuracoes_igreja
  DROP COLUMN IF EXISTS webhook_make_liturgia,
  DROP COLUMN IF EXISTS whatsapp_provider,
  DROP COLUMN IF EXISTS whatsapp_token,
  DROP COLUMN IF EXISTS whatsapp_instance_id;
