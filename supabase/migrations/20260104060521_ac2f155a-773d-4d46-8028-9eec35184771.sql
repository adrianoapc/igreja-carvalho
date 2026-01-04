
-- =====================================================
-- MIGRAÇÃO: Atualizar RLS para usar has_filial_access (Parte 1)
-- =====================================================

-- Atualizar has_filial_access para ser mais permissivo quando filial_id é NULL
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

-- agenda_pastoral
DROP POLICY IF EXISTS "Staff pode ver agenda pastoral" ON public.agenda_pastoral;
CREATE POLICY "Staff pode ver agenda pastoral" ON public.agenda_pastoral
  FOR SELECT USING (
    (has_role(auth.uid(), 'admin'::app_role) 
     OR has_role(auth.uid(), 'pastor'::app_role) 
     OR has_role(auth.uid(), 'secretario'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Staff pode criar agenda pastoral" ON public.agenda_pastoral;
CREATE POLICY "Staff pode criar agenda pastoral" ON public.agenda_pastoral
  FOR INSERT WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) 
     OR has_role(auth.uid(), 'pastor'::app_role) 
     OR has_role(auth.uid(), 'secretario'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Staff pode atualizar agenda pastoral" ON public.agenda_pastoral;
CREATE POLICY "Staff pode atualizar agenda pastoral" ON public.agenda_pastoral
  FOR UPDATE USING (
    (has_role(auth.uid(), 'admin'::app_role) 
     OR has_role(auth.uid(), 'secretario'::app_role) 
     OR (has_role(auth.uid(), 'pastor'::app_role) 
         AND pastor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admin e secretario podem deletar agenda" ON public.agenda_pastoral;
CREATE POLICY "Admin e secretario podem deletar agenda" ON public.agenda_pastoral
  FOR DELETE USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- alteracoes_perfil_pendentes
DROP POLICY IF EXISTS "Admins can view pending changes" ON public.alteracoes_perfil_pendentes;
CREATE POLICY "Admins can view pending changes" ON public.alteracoes_perfil_pendentes
  FOR SELECT USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admins can update pending changes" ON public.alteracoes_perfil_pendentes;
CREATE POLICY "Admins can update pending changes" ON public.alteracoes_perfil_pendentes
  FOR UPDATE USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- atendimentos_bot
DROP POLICY IF EXISTS "Admins podem gerenciar atendimentos" ON public.atendimentos_bot;
CREATE POLICY "Admins podem gerenciar atendimentos" ON public.atendimentos_bot
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pastor'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Intercessores podem ver atendimentos" ON public.atendimentos_bot;
CREATE POLICY "Intercessores podem ver atendimentos" ON public.atendimentos_bot
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM intercessores WHERE user_id = auth.uid() AND ativo = true)
    AND has_filial_access(igreja_id, filial_id)
  );

-- atendimentos_pastorais
DROP POLICY IF EXISTS "Pastores e admins gerenciam atendimentos pastorais" ON public.atendimentos_pastorais;
CREATE POLICY "Pastores e admins gerenciam atendimentos pastorais" ON public.atendimentos_pastorais
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pastor'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Secretarios podem ver agenda" ON public.atendimentos_pastorais;
CREATE POLICY "Secretarios podem ver agenda" ON public.atendimentos_pastorais
  FOR SELECT USING (
    has_role(auth.uid(), 'secretario'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

-- aulas
DROP POLICY IF EXISTS "Admins podem gerenciar aulas" ON public.aulas;
CREATE POLICY "Admins podem gerenciar aulas" ON public.aulas
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Auth pode ver aulas" ON public.aulas;
CREATE POLICY "Auth pode ver aulas" ON public.aulas
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- banners  
DROP POLICY IF EXISTS "Admins podem criar banners" ON public.banners;
CREATE POLICY "Admins podem criar banners" ON public.banners
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admins podem atualizar banners" ON public.banners;
CREATE POLICY "Admins podem atualizar banners" ON public.banners
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admins podem deletar banners" ON public.banners;
CREATE POLICY "Admins podem deletar banners" ON public.banners
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver banners no período" ON public.banners;
CREATE POLICY "Todos podem ver banners no período" ON public.banners
  FOR SELECT USING (
    (has_role(auth.uid(), 'admin'::app_role) OR is_banner_active(active, scheduled_at, expires_at))
    AND has_filial_access(igreja_id, filial_id)
  );
