
-- =====================================================
-- MIGRAÇÃO: Atualizar RLS para usar has_filial_access (Parte 2)
-- =====================================================

-- cancoes_culto
DROP POLICY IF EXISTS "Admins podem gerenciar canções" ON public.cancoes_culto;
CREATE POLICY "Admins podem gerenciar canções" ON public.cancoes_culto
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver canções" ON public.cancoes_culto;
CREATE POLICY "Membros podem ver canções" ON public.cancoes_culto
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- candidatos_voluntario
DROP POLICY IF EXISTS "Admins podem gerenciar candidatos" ON public.candidatos_voluntario;
CREATE POLICY "Admins podem gerenciar candidatos" ON public.candidatos_voluntario
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  ) WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Ver própria candidatura" ON public.candidatos_voluntario;
CREATE POLICY "Ver própria candidatura" ON public.candidatos_voluntario
  FOR SELECT USING (
    pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

-- candidatos_voluntario_historico
DROP POLICY IF EXISTS "Admins e líderes podem ver histórico" ON public.candidatos_voluntario_historico;
CREATE POLICY "Admins e líderes podem ver histórico" ON public.candidatos_voluntario_historico
  FOR SELECT USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- categorias_times
DROP POLICY IF EXISTS "Admins podem gerenciar categorias" ON public.categorias_times;
CREATE POLICY "Admins podem gerenciar categorias" ON public.categorias_times
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver categorias ativas" ON public.categorias_times;
CREATE POLICY "Todos podem ver categorias ativas" ON public.categorias_times
  FOR SELECT USING (
    (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- checkins
DROP POLICY IF EXISTS "Lideres gerenciam checkins" ON public.checkins;
CREATE POLICY "Lideres gerenciam checkins" ON public.checkins
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver checkins" ON public.checkins;
CREATE POLICY "Membros podem ver checkins" ON public.checkins
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND has_filial_access(igreja_id, filial_id)
  );

-- comunicados
DROP POLICY IF EXISTS "comunicados_gestao_admin" ON public.comunicados;
CREATE POLICY "comunicados_gestao_admin" ON public.comunicados
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "comunicados_leitura_publica" ON public.comunicados;
CREATE POLICY "comunicados_leitura_publica" ON public.comunicados
  FOR SELECT USING (
    ativo = true 
    AND data_inicio <= now() 
    AND (data_fim IS NULL OR data_fim >= now())
    AND has_filial_access(igreja_id, filial_id)
  );

-- escalas_template
DROP POLICY IF EXISTS "Admins podem gerenciar escalas de templates" ON public.escalas_template;
CREATE POLICY "Admins podem gerenciar escalas de templates" ON public.escalas_template
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver escalas de templates ativos" ON public.escalas_template;
CREATE POLICY "Membros podem ver escalas de templates ativos" ON public.escalas_template
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM templates_culto WHERE id = template_id AND (ativo = true OR has_role(auth.uid(), 'admin'::app_role)))
    AND has_filial_access(igreja_id, filial_id)
  );

-- etapas_jornada
DROP POLICY IF EXISTS "Admins podem gerenciar etapas" ON public.etapas_jornada;
CREATE POLICY "Admins podem gerenciar etapas" ON public.etapas_jornada
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver etapas" ON public.etapas_jornada;
CREATE POLICY "Todos podem ver etapas" ON public.etapas_jornada
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- evento_subtipos
DROP POLICY IF EXISTS "Admin gerencia subtipos" ON public.evento_subtipos;
CREATE POLICY "Admin gerencia subtipos" ON public.evento_subtipos
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Leitura publica subtipos" ON public.evento_subtipos;
CREATE POLICY "Leitura publica subtipos" ON public.evento_subtipos
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));
