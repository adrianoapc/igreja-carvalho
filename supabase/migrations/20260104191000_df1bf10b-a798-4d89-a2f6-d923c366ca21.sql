
-- =====================================================
-- MIGRAÇÃO: Isolamento Multi-Tenant user_roles
-- ADR-021: Garantir que papéis sejam escopados por igreja
-- =====================================================

-- 1. Adicionar coluna igreja_id na tabela user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id) ON DELETE CASCADE;

-- 2. Preencher igreja_id baseado no profile do usuário
UPDATE public.user_roles ur
SET igreja_id = (
  SELECT p.igreja_id 
  FROM public.profiles p 
  WHERE p.user_id = ur.user_id 
  LIMIT 1
)
WHERE ur.igreja_id IS NULL;

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_user_roles_igreja_id ON public.user_roles(igreja_id);

-- 4. Criar índice composto para queries frequentes
CREATE INDEX IF NOT EXISTS idx_user_roles_igreja_user ON public.user_roles(igreja_id, user_id);

-- 5. Atualizar constraint unique para incluir igreja_id
-- (permite mesmo usuário ter papéis diferentes em igrejas diferentes)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_igreja_key 
  UNIQUE (user_id, role, igreja_id);

-- 6. Dropar políticas RLS antigas
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can see their roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- 7. Criar novas políticas RLS com escopo de igreja
-- SELECT: Usuário vê seus próprios papéis OU admin da mesma igreja vê todos
CREATE POLICY "user_roles_select_own_or_admin"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND (igreja_id IS NULL OR igreja_id = get_current_user_igreja_id())
  )
  OR (
    has_role(auth.uid(), 'admin_igreja'::app_role)
    AND igreja_id = get_current_user_igreja_id()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- INSERT: Apenas admins podem atribuir papéis na mesma igreja
CREATE POLICY "user_roles_insert_admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND (igreja_id IS NULL OR igreja_id = get_current_user_igreja_id())
  )
  OR (
    has_role(auth.uid(), 'admin_igreja'::app_role)
    AND igreja_id = get_current_user_igreja_id()
    AND role NOT IN ('super_admin', 'admin')  -- admin_igreja não pode criar super_admin/admin
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- UPDATE: Apenas admins podem alterar papéis na mesma igreja
CREATE POLICY "user_roles_update_admin"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND (igreja_id IS NULL OR igreja_id = get_current_user_igreja_id())
  )
  OR (
    has_role(auth.uid(), 'admin_igreja'::app_role)
    AND igreja_id = get_current_user_igreja_id()
    AND role NOT IN ('super_admin', 'admin')
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- DELETE: Apenas admins podem remover papéis na mesma igreja
CREATE POLICY "user_roles_delete_admin"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND (igreja_id IS NULL OR igreja_id = get_current_user_igreja_id())
  )
  OR (
    has_role(auth.uid(), 'admin_igreja'::app_role)
    AND igreja_id = get_current_user_igreja_id()
    AND role NOT IN ('super_admin', 'admin')
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 8. Criar função auxiliar has_role_in_igreja para validações futuras
CREATE OR REPLACE FUNCTION public.has_role_in_igreja(_user_id uuid, _role app_role, _igreja_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = _role
      AND (igreja_id = _igreja_id OR igreja_id IS NULL)
  )
$$;

-- 9. Comentários para documentação
COMMENT ON COLUMN public.user_roles.igreja_id IS 'Igreja onde o papel é válido. NULL para papéis globais (super_admin).';
COMMENT ON FUNCTION public.has_role_in_igreja IS 'Verifica se usuário tem papel específico em uma igreja.';
