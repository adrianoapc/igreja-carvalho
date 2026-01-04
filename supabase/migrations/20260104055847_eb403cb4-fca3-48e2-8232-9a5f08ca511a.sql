-- Atualizar has_filial_access para ser mais tolerante (aceitar NULL)
CREATE OR REPLACE FUNCTION public.has_filial_access(_igreja_id UUID, _filial_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin global tem acesso total
    has_role(auth.uid(), 'admin'::app_role)
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
        )
      )
    );
$$;

-- Atualizar políticas principais (financeiro)
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar contas" ON public.contas;
CREATE POLICY "Admins e tesoureiros podem gerenciar contas" ON public.contas
  FOR ALL
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar bases ministeriais" ON public.bases_ministeriais;
CREATE POLICY "Admins e tesoureiros podem gerenciar bases ministeriais" ON public.bases_ministeriais
  FOR ALL
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar centros de custo" ON public.centros_custo;
CREATE POLICY "Admins e tesoureiros podem gerenciar centros de custo" ON public.centros_custo
  FOR ALL
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar categorias" ON public.categorias_financeiras;
CREATE POLICY "Admins e tesoureiros podem gerenciar categorias" ON public.categorias_financeiras
  FOR ALL
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar transações" ON public.transacoes_financeiras;
CREATE POLICY "Admins e tesoureiros podem gerenciar transações" ON public.transacoes_financeiras
  FOR ALL
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND public.has_filial_access(igreja_id, filial_id));