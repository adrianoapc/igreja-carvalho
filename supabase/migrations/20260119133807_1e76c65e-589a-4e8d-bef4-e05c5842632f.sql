-- Tabela de roteamento de numeros WhatsApp por igreja/filial

CREATE TABLE IF NOT EXISTS public.whatsapp_numeros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES public.filiais(id) ON DELETE SET NULL,
  phone_number_id TEXT,
  display_phone_number TEXT,
  provider TEXT NOT NULL DEFAULT 'meta',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_numeros_phone_number_id_key
ON public.whatsapp_numeros(phone_number_id)
WHERE phone_number_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_numeros_display_phone_number_key
ON public.whatsapp_numeros(display_phone_number)
WHERE display_phone_number IS NOT NULL;

ALTER TABLE public.whatsapp_numeros ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_whatsapp_numeros_updated_at ON public.whatsapp_numeros;
CREATE TRIGGER update_whatsapp_numeros_updated_at
BEFORE UPDATE ON public.whatsapp_numeros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Igreja pode ver whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Igreja pode ver whatsapp numeros"
ON public.whatsapp_numeros
FOR SELECT
USING (igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid);

DROP POLICY IF EXISTS "Admins podem inserir whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Admins podem inserir whatsapp numeros"
ON public.whatsapp_numeros
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  AND igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
);

DROP POLICY IF EXISTS "Admins podem atualizar whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Admins podem atualizar whatsapp numeros"
ON public.whatsapp_numeros
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  AND igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
)
WITH CHECK (
  igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
);

DROP POLICY IF EXISTS "Admins podem remover whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Admins podem remover whatsapp numeros"
ON public.whatsapp_numeros
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  AND igreja_id = nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid
);