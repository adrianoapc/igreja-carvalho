-- Parte 3: RLS e políticas para as novas tabelas

-- RLS para igrejas
ALTER TABLE public.igrejas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin pode ver todas igrejas" ON public.igrejas;
CREATE POLICY "Super admin pode ver todas igrejas"
  ON public.igrejas
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admin pode gerenciar igrejas" ON public.igrejas;
CREATE POLICY "Super admin pode gerenciar igrejas"
  ON public.igrejas
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin igreja pode ver sua igreja" ON public.igrejas;
CREATE POLICY "Admin igreja pode ver sua igreja"
  ON public.igrejas
  FOR SELECT
  USING (id = public.get_current_user_igreja_id());

-- RLS para tenant_metricas
ALTER TABLE public.tenant_metricas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin pode ver todas metricas" ON public.tenant_metricas;
CREATE POLICY "Super admin pode ver todas metricas"
  ON public.tenant_metricas
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admin pode gerenciar metricas" ON public.tenant_metricas;
CREATE POLICY "Super admin pode gerenciar metricas"
  ON public.tenant_metricas
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin igreja pode ver metricas da sua igreja" ON public.tenant_metricas;
CREATE POLICY "Admin igreja pode ver metricas da sua igreja"
  ON public.tenant_metricas
  FOR SELECT
  USING (igreja_id = public.get_current_user_igreja_id());

-- RLS para onboarding_requests
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin gerencia onboarding" ON public.onboarding_requests;
CREATE POLICY "Super admin gerencia onboarding"
  ON public.onboarding_requests
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Qualquer um pode criar solicitacao" ON public.onboarding_requests;
CREATE POLICY "Qualquer um pode criar solicitacao"
  ON public.onboarding_requests
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Usuario pode ver sua solicitacao" ON public.onboarding_requests;
CREATE POLICY "Usuario pode ver sua solicitacao"
  ON public.onboarding_requests
  FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));