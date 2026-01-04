
-- =====================================================
-- MIGRAÇÃO: Corrigir RLS Parte 6 (usando enum correto)
-- =====================================================

-- tags_midias
DROP POLICY IF EXISTS "Admins podem gerenciar tags" ON public.tags_midias;
CREATE POLICY "Admins podem gerenciar tags" ON public.tags_midias
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver tags" ON public.tags_midias;
CREATE POLICY "Todos podem ver tags" ON public.tags_midias
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- tarefas
DROP POLICY IF EXISTS "Admins podem gerenciar tarefas" ON public.tarefas;
CREATE POLICY "Admins podem gerenciar tarefas" ON public.tarefas
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Responsaveis podem ver tarefas" ON public.tarefas;
CREATE POLICY "Responsaveis podem ver tarefas" ON public.tarefas
  FOR SELECT USING (
    responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Responsaveis podem atualizar tarefas" ON public.tarefas;
CREATE POLICY "Responsaveis podem atualizar tarefas" ON public.tarefas
  FOR UPDATE USING (
    responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

-- templates_culto
DROP POLICY IF EXISTS "Admins podem gerenciar templates" ON public.templates_culto;
CREATE POLICY "Admins podem gerenciar templates" ON public.templates_culto
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver templates ativos" ON public.templates_culto;
CREATE POLICY "Membros podem ver templates ativos" ON public.templates_culto
  FOR SELECT USING (
    (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- testemunhos (usando valores corretos do enum: aberto, publico, arquivado)
DROP POLICY IF EXISTS "Admins podem gerenciar testemunhos" ON public.testemunhos;
CREATE POLICY "Admins podem gerenciar testemunhos" ON public.testemunhos
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver testemunhos publicos" ON public.testemunhos;
CREATE POLICY "Todos podem ver testemunhos publicos" ON public.testemunhos
  FOR SELECT USING (
    (status = 'publico'::status_testemunho OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuarios podem criar testemunhos" ON public.testemunhos;
CREATE POLICY "Usuarios podem criar testemunhos" ON public.testemunhos
  FOR INSERT WITH CHECK (
    autor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

-- times
DROP POLICY IF EXISTS "Admins podem gerenciar times" ON public.times;
CREATE POLICY "Admins podem gerenciar times" ON public.times
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver times ativos" ON public.times;
CREATE POLICY "Membros podem ver times ativos" ON public.times
  FOR SELECT USING (
    (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- Criar índices compostos para queries mais comuns
CREATE INDEX IF NOT EXISTS idx_profiles_igreja_filial ON public.profiles(igreja_id, filial_id);
CREATE INDEX IF NOT EXISTS idx_eventos_igreja_filial_data ON public.eventos(igreja_id, filial_id, data_evento);
CREATE INDEX IF NOT EXISTS idx_transacoes_igreja_filial_data ON public.transacoes_financeiras(igreja_id, filial_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_escalas_igreja_filial ON public.escalas(igreja_id, filial_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_igreja_filial ON public.pedidos_oracao(igreja_id, filial_id);
CREATE INDEX IF NOT EXISTS idx_checkins_igreja_filial ON public.checkins(igreja_id, filial_id);
