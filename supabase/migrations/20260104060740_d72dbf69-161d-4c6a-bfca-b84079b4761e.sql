
-- =====================================================
-- MIGRAÇÃO: Corrigir RLS Parte 5 (corrigido)
-- =====================================================

-- notifications
DROP POLICY IF EXISTS "Usuarios podem ver proprias notificacoes" ON public.notifications;
CREATE POLICY "Usuarios podem ver proprias notificacoes" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuarios podem atualizar proprias notificacoes" ON public.notifications;
CREATE POLICY "Usuarios podem atualizar proprias notificacoes" ON public.notifications
  FOR UPDATE USING (
    user_id = auth.uid()
    AND has_filial_access(igreja_id, filial_id)
  );

-- pedidos_oracao
DROP POLICY IF EXISTS "Admins e intercessores podem gerenciar pedidos" ON public.pedidos_oracao;
CREATE POLICY "Admins e intercessores podem gerenciar pedidos" ON public.pedidos_oracao
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) 
     OR has_role(auth.uid(), 'pastor'::app_role)
     OR EXISTS (SELECT 1 FROM intercessores WHERE user_id = auth.uid() AND ativo = true))
    AND has_filial_access(igreja_id, filial_id)
  );

-- posicoes_time
DROP POLICY IF EXISTS "Admins podem gerenciar posições" ON public.posicoes_time;
CREATE POLICY "Admins podem gerenciar posições" ON public.posicoes_time
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver posições ativas" ON public.posicoes_time;
CREATE POLICY "Membros podem ver posições ativas" ON public.posicoes_time
  FOR SELECT USING (
    (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- presencas_aula (usando aluno_id em vez de pessoa_id)
DROP POLICY IF EXISTS "Admins podem gerenciar presencas" ON public.presencas_aula;
CREATE POLICY "Admins podem gerenciar presencas" ON public.presencas_aula
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Alunos podem ver proprias presencas" ON public.presencas_aula;
CREATE POLICY "Alunos podem ver proprias presencas" ON public.presencas_aula
  FOR SELECT USING (
    aluno_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

-- projetos
DROP POLICY IF EXISTS "Admins podem gerenciar projetos" ON public.projetos;
CREATE POLICY "Admins podem gerenciar projetos" ON public.projetos
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Membros podem ver projetos" ON public.projetos;
CREATE POLICY "Membros podem ver projetos" ON public.projetos
  FOR SELECT USING (has_filial_access(igreja_id, filial_id));

-- salas
DROP POLICY IF EXISTS "Admins podem gerenciar salas" ON public.salas;
CREATE POLICY "Admins podem gerenciar salas" ON public.salas
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver salas ativas" ON public.salas;
CREATE POLICY "Todos podem ver salas ativas" ON public.salas
  FOR SELECT USING (
    (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- sentimentos_membros
DROP POLICY IF EXISTS "Admins e pastores podem ver sentimentos" ON public.sentimentos_membros;
CREATE POLICY "Admins e pastores podem ver sentimentos" ON public.sentimentos_membros
  FOR SELECT USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pastor'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuarios podem registrar proprios sentimentos" ON public.sentimentos_membros;
CREATE POLICY "Usuarios podem registrar proprios sentimentos" ON public.sentimentos_membros
  FOR INSERT WITH CHECK (
    pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuarios podem ver proprios sentimentos" ON public.sentimentos_membros;
CREATE POLICY "Usuarios podem ver proprios sentimentos" ON public.sentimentos_membros
  FOR SELECT USING (
    pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

-- solicitacoes_reembolso
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar reembolsos" ON public.solicitacoes_reembolso;
CREATE POLICY "Admins e tesoureiros podem gerenciar reembolsos" ON public.solicitacoes_reembolso
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  ) WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuarios podem ver proprios reembolsos" ON public.solicitacoes_reembolso;
CREATE POLICY "Usuarios podem ver proprios reembolsos" ON public.solicitacoes_reembolso
  FOR SELECT USING (
    solicitante_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuarios podem criar proprios reembolsos" ON public.solicitacoes_reembolso;
CREATE POLICY "Usuarios podem criar proprios reembolsos" ON public.solicitacoes_reembolso
  FOR INSERT WITH CHECK (
    solicitante_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );
