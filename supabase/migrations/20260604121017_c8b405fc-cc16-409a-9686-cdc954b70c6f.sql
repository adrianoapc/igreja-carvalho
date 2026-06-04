
-- IGREJAS: remover SELECT público (true) e restringir a usuários autenticados da própria igreja
DROP POLICY IF EXISTS "Todos podem ver igrejas" ON public.igrejas;

CREATE POLICY "Usuários autenticados veem sua igreja"
ON public.igrejas
FOR SELECT
TO authenticated
USING (
  id = public.get_current_user_igreja_id()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- FILIAIS: remover fallback NULL que vazava para anônimos
DROP POLICY IF EXISTS "Usuarios podem ver filiais da igreja" ON public.filiais;

CREATE POLICY "Usuários autenticados veem filiais da sua igreja"
ON public.filiais
FOR SELECT
TO authenticated
USING (
  igreja_id = public.get_jwt_igreja_id()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- CONFIGURACOES_IGREJA: remover SELECT público (true)
DROP POLICY IF EXISTS "Todos podem ver configurações" ON public.configuracoes_igreja;

CREATE POLICY "Usuários autenticados veem config da sua igreja"
ON public.configuracoes_igreja
FOR SELECT
TO authenticated
USING (
  igreja_id = public.get_current_user_igreja_id()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
