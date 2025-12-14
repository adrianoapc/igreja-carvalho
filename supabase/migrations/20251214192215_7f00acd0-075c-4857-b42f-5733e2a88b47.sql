-- Adicionar coluna allow_public_access à tabela app_config
ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS allow_public_access BOOLEAN DEFAULT true;

-- Atualizar política de UPDATE para usar has_role (evita recursão)
DROP POLICY IF EXISTS "Admin e Tecnico gerenciam config" ON public.app_config;
CREATE POLICY "Admin e Tecnico gerenciam config" 
ON public.app_config FOR UPDATE 
TO authenticated 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role)
);