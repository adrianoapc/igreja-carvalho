-- Adicionar política de leitura para categorias_financeiras
-- Permite que usuários autenticados visualizem categorias ativas
CREATE POLICY "Usuarios autenticados podem ver categorias ativas"
ON public.categorias_financeiras
FOR SELECT
USING (auth.uid() IS NOT NULL AND ativo = true);

-- Adicionar política de leitura para subcategorias_financeiras
CREATE POLICY "Usuarios autenticados podem ver subcategorias ativas"
ON public.subcategorias_financeiras
FOR SELECT
USING (auth.uid() IS NOT NULL AND ativo = true);

-- Adicionar política de leitura para bases_ministeriais
CREATE POLICY "Usuarios autenticados podem ver bases ministeriais ativas"
ON public.bases_ministeriais
FOR SELECT
USING (auth.uid() IS NOT NULL AND ativo = true);

-- Adicionar política de leitura para centros_custo
CREATE POLICY "Usuarios autenticados podem ver centros custo ativos"
ON public.centros_custo
FOR SELECT
USING (auth.uid() IS NOT NULL AND ativo = true);

-- Adicionar política de leitura para fornecedores
CREATE POLICY "Usuarios autenticados podem ver fornecedores ativos"
ON public.fornecedores
FOR SELECT
USING (auth.uid() IS NOT NULL AND ativo = true);