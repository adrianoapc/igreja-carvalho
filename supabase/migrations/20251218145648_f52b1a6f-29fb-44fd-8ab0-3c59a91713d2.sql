-- =============================================
-- LOGS_AUDITORIA_CHAT - RLS Políticas Rigorosas
-- Garantir imutabilidade do histórico jurídico
-- =============================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.logs_auditoria_chat;
DROP POLICY IF EXISTS "Admins podem visualizar logs auditoria" ON public.logs_auditoria_chat;

-- 1. INSERT: Apenas Service Role (Edge Functions/Backend)
-- Usuários autenticados NÃO podem inserir diretamente
-- A policy retorna false para anon e authenticated, mas service_role bypassa RLS
CREATE POLICY "Apenas backend pode inserir logs"
ON public.logs_auditoria_chat
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

-- 2. SELECT: Apenas Admins e Pastores (para auditoria)
CREATE POLICY "Admins e pastores podem visualizar logs"
ON public.logs_auditoria_chat
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'pastor'::app_role)
);

-- 3. UPDATE: Bloqueado para TODOS (imutabilidade)
CREATE POLICY "Ninguem pode atualizar logs"
ON public.logs_auditoria_chat
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 4. DELETE: Bloqueado para TODOS (imutabilidade)
CREATE POLICY "Ninguem pode deletar logs"
ON public.logs_auditoria_chat
FOR DELETE
TO anon, authenticated
USING (false);

-- Adicionar comentário explicativo na tabela
COMMENT ON TABLE public.logs_auditoria_chat IS 'Tabela de auditoria APPEND-ONLY para compliance LGPD. INSERT apenas via service_role (Edge Functions). UPDATE/DELETE bloqueados para todos.';