-- Drop existing RLS policies
DROP POLICY IF EXISTS "Igreja pode ver whatsapp numeros" ON public.whatsapp_numeros;
DROP POLICY IF EXISTS "Admins podem inserir whatsapp numeros" ON public.whatsapp_numeros;
DROP POLICY IF EXISTS "Admins podem atualizar whatsapp numeros" ON public.whatsapp_numeros;
DROP POLICY IF EXISTS "Admins podem remover whatsapp numeros" ON public.whatsapp_numeros;

-- Recreate policies using auth.jwt() which correctly accesses app_metadata
CREATE POLICY "Igreja pode ver whatsapp numeros" 
ON public.whatsapp_numeros 
FOR SELECT 
USING (
  igreja_id = ((auth.jwt() -> 'app_metadata' ->> 'igreja_id')::uuid)
);

CREATE POLICY "Admins podem inserir whatsapp numeros" 
ON public.whatsapp_numeros 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  igreja_id = ((auth.jwt() -> 'app_metadata' ->> 'igreja_id')::uuid)
);

CREATE POLICY "Admins podem atualizar whatsapp numeros" 
ON public.whatsapp_numeros 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  igreja_id = ((auth.jwt() -> 'app_metadata' ->> 'igreja_id')::uuid)
)
WITH CHECK (
  igreja_id = ((auth.jwt() -> 'app_metadata' ->> 'igreja_id')::uuid)
);

CREATE POLICY "Admins podem remover whatsapp numeros" 
ON public.whatsapp_numeros 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  igreja_id = ((auth.jwt() -> 'app_metadata' ->> 'igreja_id')::uuid)
);