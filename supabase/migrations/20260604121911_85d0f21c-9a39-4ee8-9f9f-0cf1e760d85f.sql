
-- 1) Fix search_path on public functions
ALTER FUNCTION public.aplicar_sugestao_conciliacao(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.atualizar_valor_total_solicitacao() SET search_path = public;
ALTER FUNCTION public.audit_contact_changes() SET search_path = public;
ALTER FUNCTION public.audit_profile_changes() SET search_path = public;
ALTER FUNCTION public.desconciliar_transacao(uuid) SET search_path = public;
ALTER FUNCTION public.diagnosticar_extrato(uuid) SET search_path = public;
ALTER FUNCTION public.rejeitar_sugestao_conciliacao(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.update_pix_webhook_temp_updated_at() SET search_path = public;

-- 2) Drop always-true INSERT policies that should only be reachable via service_role
--    service_role bypasses RLS so these tables remain writable by backend edge functions.
DROP POLICY IF EXISTS "Sistema pode criar notificações" ON public.notifications;
DROP POLICY IF EXISTS "Sistema pode inserir configurações" ON public.edge_function_config;
DROP POLICY IF EXISTS "Edge function can insert pending changes" ON public.alteracoes_perfil_pendentes;
DROP POLICY IF EXISTS "Sistema pode inserir atendimentos" ON public.atendimentos_bot;
DROP POLICY IF EXISTS "Sistema pode inserir histórico" ON public.candidatos_voluntario_historico;

-- 3) otp_verificacao: RLS enabled but no policies. OTP must only be managed by edge functions (service_role).
--    Add an explicit deny-by-default policy for safety; service_role bypasses RLS.
CREATE POLICY "OTP read denied for clients"
  ON public.otp_verificacao FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "OTP write denied for clients"
  ON public.otp_verificacao FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 4) Revoke Data API exposure of materialized view
REVOKE ALL ON public.mv_conciliacao_dataset FROM anon, authenticated;

-- 5) Restrict Realtime channel subscription so users only receive their own notification events.
--    Topic convention: 'notifications:{user.id}' (channel name used in useNotifications hook).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can subscribe to their own notification topics" ON realtime.messages;
CREATE POLICY "Users can subscribe to their own notification topics"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Allow channels scoped to the user's own id (e.g. 'notifications:<uuid>')
      split_part(realtime.topic(), ':', 2) = auth.uid()::text
      -- Allow generic non user-scoped channels (no ':' in topic)
      OR position(':' in realtime.topic()) = 0
    )
  );
