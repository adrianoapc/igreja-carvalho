
-- =====================================================
-- MIGRAÇÃO: Atualizar RLS para usar has_filial_access (Parte 4)
-- =====================================================

-- jornadas
DROP POLICY IF EXISTS "Admins podem gerenciar jornadas" ON public.jornadas;
CREATE POLICY "Admins podem gerenciar jornadas" ON public.jornadas
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver jornadas ativas" ON public.jornadas;
CREATE POLICY "Todos podem ver jornadas ativas" ON public.jornadas
  FOR SELECT USING (
    (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- kids_checkins
DROP POLICY IF EXISTS "Staff pode gerenciar checkins kids" ON public.kids_checkins;
CREATE POLICY "Staff pode gerenciar checkins kids" ON public.kids_checkins
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Responsaveis podem ver checkins dos filhos" ON public.kids_checkins;
CREATE POLICY "Responsaveis podem ver checkins dos filhos" ON public.kids_checkins
  FOR SELECT USING (
    responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

-- liturgia_recursos
DROP POLICY IF EXISTS "Admins podem gerenciar recursos liturgia" ON public.liturgia_recursos;
CREATE POLICY "Admins podem gerenciar recursos liturgia" ON public.liturgia_recursos
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver recursos liturgia" ON public.liturgia_recursos;
CREATE POLICY "Todos podem ver recursos liturgia" ON public.liturgia_recursos
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- liturgia_templates
DROP POLICY IF EXISTS "Admins podem gerenciar templates liturgia" ON public.liturgia_templates;
CREATE POLICY "Admins podem gerenciar templates liturgia" ON public.liturgia_templates
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver templates liturgia" ON public.liturgia_templates;
CREATE POLICY "Todos podem ver templates liturgia" ON public.liturgia_templates
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- liturgias
DROP POLICY IF EXISTS "Admins podem gerenciar liturgias" ON public.liturgias;
CREATE POLICY "Admins podem gerenciar liturgias" ON public.liturgias
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver liturgias" ON public.liturgias;
CREATE POLICY "Todos podem ver liturgias" ON public.liturgias
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- membro_funcoes
DROP POLICY IF EXISTS "Admins podem gerenciar funcoes membros" ON public.membro_funcoes;
CREATE POLICY "Admins podem gerenciar funcoes membros" ON public.membro_funcoes
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver funcoes" ON public.membro_funcoes;
CREATE POLICY "Membros podem ver funcoes" ON public.membro_funcoes
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- membros_time
DROP POLICY IF EXISTS "Admins podem gerenciar membros de times" ON public.membros_time;
CREATE POLICY "Admins podem gerenciar membros de times" ON public.membros_time
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver membros de times" ON public.membros_time;
CREATE POLICY "Membros podem ver membros de times" ON public.membros_time
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- midia_tags
DROP POLICY IF EXISTS "Admins podem gerenciar midia_tags" ON public.midia_tags;
CREATE POLICY "Admins podem gerenciar midia_tags" ON public.midia_tags
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver midia_tags" ON public.midia_tags;
CREATE POLICY "Todos podem ver midia_tags" ON public.midia_tags
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- midias
DROP POLICY IF EXISTS "Admins podem gerenciar midias" ON public.midias;
CREATE POLICY "Admins podem gerenciar midias" ON public.midias
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver midias ativas" ON public.midias;
CREATE POLICY "Todos podem ver midias ativas" ON public.midias
  FOR SELECT USING (
    (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );
