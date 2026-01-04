
-- =====================================================
-- MIGRAÇÃO: Atualizar RLS para usar has_filial_access (Parte 3)
-- =====================================================

-- eventos_convites
DROP POLICY IF EXISTS "Admin e lider podem ver todos os convites" ON public.eventos_convites;
CREATE POLICY "Admin e lider podem ver todos os convites" ON public.eventos_convites
  FOR SELECT USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuario pode ver seus proprios convites" ON public.eventos_convites;
CREATE POLICY "Usuario pode ver seus proprios convites" ON public.eventos_convites
  FOR SELECT USING (
    pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admin pode criar convites" ON public.eventos_convites;
CREATE POLICY "Admin pode criar convites" ON public.eventos_convites
  FOR INSERT WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuario pode responder seu convite" ON public.eventos_convites;
CREATE POLICY "Usuario pode responder seu convite" ON public.eventos_convites
  FOR UPDATE USING (
    pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admin pode atualizar convites" ON public.eventos_convites;
CREATE POLICY "Admin pode atualizar convites" ON public.eventos_convites
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admin pode deletar convites" ON public.eventos_convites;
CREATE POLICY "Admin pode deletar convites" ON public.eventos_convites
  FOR DELETE USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- formas_pagamento
DROP POLICY IF EXISTS "Admins e tesoureiros gerenciam formas pagamento" ON public.formas_pagamento;
CREATE POLICY "Admins e tesoureiros gerenciam formas pagamento" ON public.formas_pagamento
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  ) WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Usuarios autenticados podem ver formas pagamento ativas" ON public.formas_pagamento;
CREATE POLICY "Usuarios autenticados podem ver formas pagamento ativas" ON public.formas_pagamento
  FOR SELECT USING (
    auth.uid() IS NOT NULL 
    AND ativo = true
    AND has_filial_access(igreja_id, filial_id)
  );

-- funcoes_igreja
DROP POLICY IF EXISTS "Admins podem gerenciar funcoes" ON public.funcoes_igreja;
CREATE POLICY "Admins podem gerenciar funcoes" ON public.funcoes_igreja
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Todos podem ver funcoes ativas" ON public.funcoes_igreja;
CREATE POLICY "Todos podem ver funcoes ativas" ON public.funcoes_igreja
  FOR SELECT USING (
    (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- intercessores
DROP POLICY IF EXISTS "Admins e intercessores podem ver intercessores" ON public.intercessores;
CREATE POLICY "Admins e intercessores podem ver intercessores" ON public.intercessores
  FOR SELECT USING (
    (has_role(auth.uid(), 'admin'::app_role) 
     OR has_role(auth.uid(), 'pastor'::app_role)
     OR user_id = auth.uid())
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admins podem gerenciar intercessores" ON public.intercessores;
CREATE POLICY "Admins podem gerenciar intercessores" ON public.intercessores
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pastor'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- itens_reembolso
DROP POLICY IF EXISTS "Ver itens dos próprios reembolsos" ON public.itens_reembolso;
CREATE POLICY "Ver itens dos próprios reembolsos" ON public.itens_reembolso
  FOR SELECT USING (
    solicitacao_id IN (
      SELECT id FROM solicitacoes_reembolso 
      WHERE solicitante_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admins e tesoureiros podem ver todos itens" ON public.itens_reembolso;
CREATE POLICY "Admins e tesoureiros podem ver todos itens" ON public.itens_reembolso
  FOR SELECT USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar itens" ON public.itens_reembolso;
CREATE POLICY "Admins e tesoureiros podem gerenciar itens" ON public.itens_reembolso
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  ) WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );
