-- Add RLS policies for integracoes_financeiras_secrets table
-- Note: This table should only be accessed via Edge Functions with service_role
-- Direct client access is restricted via RLS policies

CREATE POLICY "Service role only - no direct access"
ON public.integracoes_financeiras_secrets FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "Service role only - no direct insert"
ON public.integracoes_financeiras_secrets FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Service role only - no direct update"
ON public.integracoes_financeiras_secrets FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Service role only - no direct delete"
ON public.integracoes_financeiras_secrets FOR DELETE
TO authenticated
USING (false);

-- Comment explaining the RLS strategy
COMMENT ON TABLE public.integracoes_financeiras_secrets IS
'Secrets sensiveis das integracoes financeiras (armazenar criptografado).
RLS policies bloqueiam acesso direto - dados devem ser acessados apenas via Edge Functions com service_role.';