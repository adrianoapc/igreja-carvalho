-- Habilita membros a INSERIR transações, mas SÓ se for de reembolso
CREATE POLICY "Membros criam itens de reembolso"
ON public.transacoes_financeiras
FOR INSERT
TO authenticated
WITH CHECK (
  -- O campo solicitacao_reembolso_id DEVE estar preenchido
  solicitacao_reembolso_id IS NOT NULL 
  AND 
  -- O usuário deve ser o dono da solicitação vinculada (via profiles)
  EXISTS (
    SELECT 1 FROM public.solicitacoes_reembolso sr
    JOIN public.profiles p ON p.id = sr.solicitante_id
    WHERE sr.id = solicitacao_reembolso_id
    AND p.user_id = auth.uid()
  )
);

-- Habilita membros a VEREM suas próprias transações de reembolso
CREATE POLICY "Membros veem seus itens de reembolso"
ON public.transacoes_financeiras
FOR SELECT
TO authenticated
USING (
  solicitacao_reembolso_id IS NOT NULL 
  AND 
  EXISTS (
    SELECT 1 FROM public.solicitacoes_reembolso sr
    JOIN public.profiles p ON p.id = sr.solicitante_id
    WHERE sr.id = solicitacao_reembolso_id
    AND p.user_id = auth.uid()
  )
);

-- Habilita membros a EDITAR itens (enquanto for rascunho)
CREATE POLICY "Membros editam itens de reembolso rascunho"
ON public.transacoes_financeiras
FOR UPDATE
TO authenticated
USING (
  solicitacao_reembolso_id IS NOT NULL 
  AND 
  EXISTS (
    SELECT 1 FROM public.solicitacoes_reembolso sr
    JOIN public.profiles p ON p.id = sr.solicitante_id
    WHERE sr.id = solicitacao_reembolso_id
    AND p.user_id = auth.uid()
    AND sr.status = 'rascunho'
  )
);

-- Habilita membros a EXCLUIR itens (enquanto for rascunho)
CREATE POLICY "Membros excluem itens de reembolso rascunho"
ON public.transacoes_financeiras
FOR DELETE
TO authenticated
USING (
  solicitacao_reembolso_id IS NOT NULL 
  AND 
  EXISTS (
    SELECT 1 FROM public.solicitacoes_reembolso sr
    JOIN public.profiles p ON p.id = sr.solicitante_id
    WHERE sr.id = solicitacao_reembolso_id
    AND p.user_id = auth.uid()
    AND sr.status = 'rascunho'
  )
);