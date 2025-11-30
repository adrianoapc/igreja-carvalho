-- =====================================================
-- REFORÇO DE SEGURANÇA: Tabela fornecedores
-- =====================================================
-- Este script adiciona segurança para dados sensíveis de fornecedores
-- (CPF/CNPJ, emails, telefones, endereços)

-- 1. Garantir que RLS está habilitado
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- 2. Remover política antiga genérica
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar fornecedores" ON public.fornecedores;

-- 3. Criar políticas separadas e mais específicas
-- Política SELECT: apenas admins e tesoureiros
CREATE POLICY "only_admins_treasurers_can_view_suppliers" 
ON public.fornecedores 
FOR SELECT 
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND auth.uid() IS NOT NULL
);

-- Política INSERT: apenas admins e tesoureiros
CREATE POLICY "only_admins_treasurers_can_create_suppliers" 
ON public.fornecedores 
FOR INSERT 
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND auth.uid() IS NOT NULL
);

-- Política UPDATE: apenas admins e tesoureiros
CREATE POLICY "only_admins_treasurers_can_update_suppliers" 
ON public.fornecedores 
FOR UPDATE 
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND auth.uid() IS NOT NULL
);

-- Política DELETE: apenas admins (soft delete é preferível via campo 'ativo')
CREATE POLICY "only_admins_can_delete_suppliers" 
ON public.fornecedores 
FOR DELETE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND auth.uid() IS NOT NULL
);

-- 4. Adicionar comentários de segurança
COMMENT ON TABLE public.fornecedores IS 'Tabela de fornecedores. CONTÉM DADOS SENSÍVEIS: CPF/CNPJ, emails, telefones, endereços. RLS OBRIGATÓRIO. Acesso restrito: apenas admins e tesoureiros.';

COMMENT ON COLUMN public.fornecedores.cpf_cnpj IS 'CPF/CNPJ - Dado Fiscal Sensível - Protegido por RLS - Apenas Admins/Tesoureiros';
COMMENT ON COLUMN public.fornecedores.email IS 'Email - Dado Sensível - Protegido por RLS - Apenas Admins/Tesoureiros';
COMMENT ON COLUMN public.fornecedores.telefone IS 'Telefone - Dado Sensível - Protegido por RLS - Apenas Admins/Tesoureiros';
COMMENT ON COLUMN public.fornecedores.endereco IS 'Endereço - Dado Sensível - Protegido por RLS - Apenas Admins/Tesoureiros';
COMMENT ON COLUMN public.fornecedores.cep IS 'CEP - Dado Sensível - Protegido por RLS - Apenas Admins/Tesoureiros';

-- 5. Garantir que dados sensíveis não vazem em logs
-- Criar função para mascarar CPF/CNPJ em logs se necessário
CREATE OR REPLACE FUNCTION public.mask_cpf_cnpj(cpf_cnpj TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF cpf_cnpj IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Mascarar: mostrar apenas primeiros 3 e últimos 2 dígitos
  RETURN SUBSTRING(cpf_cnpj FROM 1 FOR 3) || '***' || 
         SUBSTRING(cpf_cnpj FROM LENGTH(cpf_cnpj) - 1 FOR 2);
END;
$$;