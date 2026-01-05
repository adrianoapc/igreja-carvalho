-- =====================================================
-- PARTE 1: Limpeza de políticas RLS duplicadas
-- =====================================================
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins podem ver todas as roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias roles" ON public.user_roles;

-- =====================================================
-- PARTE 2: Criar tabela user_filial_access
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_filial_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filial_id UUID NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, filial_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_filial_access_user_id ON public.user_filial_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_filial_access_filial_id ON public.user_filial_access(filial_id);
CREATE INDEX IF NOT EXISTS idx_user_filial_access_igreja_id ON public.user_filial_access(igreja_id);

-- Habilitar RLS
ALTER TABLE public.user_filial_access ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "user_filial_access_select" ON public.user_filial_access
  FOR SELECT USING (
    user_id = auth.uid() OR
    igreja_id = public.get_current_user_igreja_id()
  );

CREATE POLICY "user_filial_access_manage" ON public.user_filial_access
  FOR ALL USING (
    igreja_id = public.get_current_user_igreja_id() AND (
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'admin_igreja'::public.app_role) OR
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

COMMENT ON TABLE public.user_filial_access IS 
  'Tabela de controle granular de acesso a filiais por usuário. 
   Permite restringir usuários específicos a determinadas filiais.';

-- =====================================================
-- PARTE 3: Atualizar função has_filial_access existente
-- Mantendo os mesmos parâmetros (_igreja_id, _filial_id)
-- Adicionando verificação na tabela user_filial_access
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_filial_access(_igreja_id UUID, _filial_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin global tem acesso total
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      -- Mesmo igreja_id ou igreja_id não definida no JWT (backwards compatibility)
      (_igreja_id = public.get_jwt_igreja_id() OR public.get_jwt_igreja_id() IS NULL)
      AND (
        -- Admin da igreja tem acesso total na igreja
        has_role(auth.uid(), 'admin_igreja'::app_role)
        OR (
          -- Admin da filial ou filial_id não definida (backwards compatibility)
          public.get_jwt_filial_id() IS NULL
          OR _filial_id IS NULL
          OR _filial_id = public.get_jwt_filial_id()
          -- Novo: verificar permissão explícita na tabela user_filial_access
          OR EXISTS (
            SELECT 1 FROM public.user_filial_access 
            WHERE user_id = auth.uid() 
            AND filial_id = _filial_id 
            AND can_view = true
          )
        )
      )
    );
$$;