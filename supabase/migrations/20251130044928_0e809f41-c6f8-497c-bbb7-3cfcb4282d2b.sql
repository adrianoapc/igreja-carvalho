-- =====================================================
-- REFORÇO DE SEGURANÇA: Tabela profiles
-- =====================================================
-- Este script adiciona camadas extras de segurança e documentação
-- para proteger dados pessoais sensíveis (CPF, RG, emails, telefones, endereços, etc)

-- 1. Garantir que RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas para recriá-las com segurança reforçada
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem atualizar qualquer perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins podem criar perfis" ON public.profiles;

-- 3. Recriar políticas com verificações mais rigorosas
-- Política SELECT para usuários: apenas seu próprio perfil
CREATE POLICY "users_can_view_own_profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  AND auth.uid() IS NOT NULL 
  AND user_id IS NOT NULL
);

-- Política SELECT para admins: todos os perfis
CREATE POLICY "admins_can_view_all_profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND auth.uid() IS NOT NULL
);

-- Política UPDATE para usuários: apenas seu próprio perfil
CREATE POLICY "users_can_update_own_profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() = user_id 
  AND auth.uid() IS NOT NULL 
  AND user_id IS NOT NULL
)
WITH CHECK (
  auth.uid() = user_id 
  AND auth.uid() IS NOT NULL 
  AND user_id IS NOT NULL
);

-- Política UPDATE para admins: qualquer perfil
CREATE POLICY "admins_can_update_any_profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND auth.uid() IS NOT NULL
);

-- Política INSERT: apenas admins podem criar perfis
CREATE POLICY "admins_can_create_profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND auth.uid() IS NOT NULL
);

-- 4. Bloquear DELETE completamente (soft delete via status é preferível)
-- Não criar política de DELETE significa que ninguém pode deletar

-- 5. Adicionar comentários de segurança na tabela
COMMENT ON TABLE public.profiles IS 'Tabela de perfis de usuários. CONTÉM DADOS SENSÍVEIS: CPF, RG, emails, telefones, endereços, tipo sanguíneo. RLS OBRIGATÓRIO. Acesso restrito: usuários veem apenas próprio perfil, admins veem todos.';

COMMENT ON COLUMN public.profiles.cpf IS 'CPF - Dado Sensível - Protegido por RLS';
COMMENT ON COLUMN public.profiles.rg IS 'RG - Dado Sensível - Protegido por RLS';
COMMENT ON COLUMN public.profiles.email IS 'Email - Dado Sensível - Protegido por RLS';
COMMENT ON COLUMN public.profiles.telefone IS 'Telefone - Dado Sensível - Protegido por RLS';
COMMENT ON COLUMN public.profiles.endereco IS 'Endereço - Dado Sensível - Protegido por RLS';
COMMENT ON COLUMN public.profiles.tipo_sanguineo IS 'Tipo Sanguíneo - Dado Médico Sensível - Protegido por RLS';
COMMENT ON COLUMN public.profiles.necessidades_especiais IS 'Necessidades Especiais - Dado Médico Sensível - Protegido por RLS';

-- 6. Criar função auxiliar para auditoria de acesso (opcional, para logs futuros)
CREATE OR REPLACE FUNCTION public.log_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Futuramente pode-se adicionar logging de acessos a dados sensíveis
  -- Por enquanto apenas retorna
  RETURN NEW;
END;
$$;

-- 7. Verificar que user_id não é nullable (segurança adicional)
-- Se user_id fosse nullable, poderia permitir bypass de RLS
-- Não vamos alterar aqui pois pode ter dados existentes, mas documentar

COMMENT ON COLUMN public.profiles.user_id IS 'ID do usuário autenticado - Referência para auth.users - CRÍTICO PARA RLS - Não deve ser NULL para usuários autenticados';