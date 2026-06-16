
-- =========================================================
-- 1) configuracoes_financeiro: scope admin/tesoureiro by church
-- =========================================================
DROP POLICY IF EXISTS "Admin e Tesoureiro gerenciam configurações" ON public.configuracoes_financeiro;

CREATE POLICY "Admin/Tesoureiro gerenciam config da própria igreja"
ON public.configuracoes_financeiro
FOR ALL
TO authenticated
USING (
  igreja_id = public.get_current_user_igreja_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  igreja_id = public.get_current_user_igreja_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- =========================================================
-- 2) pix_webhook_temp: require admin/tesoureiro for all ops
-- =========================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='pix_webhook_temp' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pix_webhook_temp', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "pix_webhook_temp_select_finance"
ON public.pix_webhook_temp FOR SELECT TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "pix_webhook_temp_insert_finance"
ON public.pix_webhook_temp FOR INSERT TO authenticated
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "pix_webhook_temp_update_finance"
ON public.pix_webhook_temp FOR UPDATE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "pix_webhook_temp_delete_finance"
ON public.pix_webhook_temp FOR DELETE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- =========================================================
-- 3) conciliacoes_lote — require admin/tesoureiro to write
-- =========================================================
DROP POLICY IF EXISTS "Usuários autenticados podem criar lotes na sua igreja" ON public.conciliacoes_lote;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar lotes da sua igreja" ON public.conciliacoes_lote;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar lotes da sua igreja" ON public.conciliacoes_lote;

CREATE POLICY "Finance team can insert lotes"
ON public.conciliacoes_lote FOR INSERT TO authenticated
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Finance team can update lotes"
ON public.conciliacoes_lote FOR UPDATE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Finance team can delete lotes"
ON public.conciliacoes_lote FOR DELETE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- conciliacoes_lote_extratos
DROP POLICY IF EXISTS "Usuários podem criar vínculos em lotes da sua igreja" ON public.conciliacoes_lote_extratos;
DROP POLICY IF EXISTS "Usuários podem deletar vínculos de lotes da sua igreja" ON public.conciliacoes_lote_extratos;
DROP POLICY IF EXISTS "Usuários podem atualizar vínculos em lotes da sua igreja" ON public.conciliacoes_lote_extratos;

CREATE POLICY "Finance team can insert lote_extratos"
ON public.conciliacoes_lote_extratos FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.conciliacoes_lote cl
    WHERE cl.id = conciliacoes_lote_extratos.conciliacao_lote_id
      AND cl.igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()))
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Finance team can delete lote_extratos"
ON public.conciliacoes_lote_extratos FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.conciliacoes_lote cl
    WHERE cl.id = conciliacoes_lote_extratos.conciliacao_lote_id
      AND cl.igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()))
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- conciliacoes_divisao
DROP POLICY IF EXISTS "Users can create divisoes for their church" ON public.conciliacoes_divisao;
DROP POLICY IF EXISTS "Users can update their church divisoes" ON public.conciliacoes_divisao;
DROP POLICY IF EXISTS "Users can delete their church divisoes" ON public.conciliacoes_divisao;

CREATE POLICY "Finance team insert divisoes"
ON public.conciliacoes_divisao FOR INSERT TO authenticated
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Finance team update divisoes"
ON public.conciliacoes_divisao FOR UPDATE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Finance team delete divisoes"
ON public.conciliacoes_divisao FOR DELETE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- conciliacoes_divisao_transacoes
DROP POLICY IF EXISTS "Users can create divisao transacoes" ON public.conciliacoes_divisao_transacoes;
DROP POLICY IF EXISTS "Users can delete divisao transacoes" ON public.conciliacoes_divisao_transacoes;

CREATE POLICY "Finance team insert divisao transacoes"
ON public.conciliacoes_divisao_transacoes FOR INSERT TO authenticated
WITH CHECK (
  conciliacao_divisao_id IN (
    SELECT id FROM public.conciliacoes_divisao
    WHERE igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Finance team delete divisao transacoes"
ON public.conciliacoes_divisao_transacoes FOR DELETE TO authenticated
USING (
  conciliacao_divisao_id IN (
    SELECT id FROM public.conciliacoes_divisao
    WHERE igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- conciliacao_ml_sugestoes
DROP POLICY IF EXISTS "Users can insert conciliação ML sugestões for their church" ON public.conciliacao_ml_sugestoes;
DROP POLICY IF EXISTS "Users can update conciliação ML sugestões from their church" ON public.conciliacao_ml_sugestoes;

CREATE POLICY "Finance team insert ML sugestoes"
ON public.conciliacao_ml_sugestoes FOR INSERT TO authenticated
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Finance team update ML sugestoes"
ON public.conciliacao_ml_sugestoes FOR UPDATE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
);

-- conciliacao_ml_feedback
DROP POLICY IF EXISTS "Users can insert conciliação ML feedback for their church" ON public.conciliacao_ml_feedback;

CREATE POLICY "Finance team insert ML feedback"
ON public.conciliacao_ml_feedback FOR INSERT TO authenticated
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- =========================================================
-- 4) transferencias_contas: require admin/tesoureiro
-- =========================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='transferencias_contas' AND cmd <> 'SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.transferencias_contas', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Finance team insert transferencias"
ON public.transferencias_contas FOR INSERT TO authenticated
WITH CHECK (
  igreja_id = public.get_jwt_igreja_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Finance team update transferencias"
ON public.transferencias_contas FOR UPDATE TO authenticated
USING (
  igreja_id = public.get_jwt_igreja_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tesoureiro'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  igreja_id = public.get_jwt_igreja_id()
);

CREATE POLICY "Finance team delete transferencias"
ON public.transferencias_contas FOR DELETE TO authenticated
USING (
  igreja_id = public.get_jwt_igreja_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- =========================================================
-- 5) webhooks: require admin/super_admin to write
-- =========================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='webhooks' AND cmd <> 'SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.webhooks', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins insert webhooks"
ON public.webhooks FOR INSERT TO authenticated
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Admins update webhooks"
ON public.webhooks FOR UPDATE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins delete webhooks"
ON public.webhooks FOR DELETE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- =========================================================
-- 6) whatsapp_numeros: require admin/super_admin to write
-- =========================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_numeros' AND cmd <> 'SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.whatsapp_numeros', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins insert whatsapp_numeros"
ON public.whatsapp_numeros FOR INSERT TO authenticated
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "Admins update whatsapp_numeros"
ON public.whatsapp_numeros FOR UPDATE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Admins delete whatsapp_numeros"
ON public.whatsapp_numeros FOR DELETE TO authenticated
USING (
  igreja_id IN (SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- =========================================================
-- 7) short_links: scope SELECT and add public resolver RPC
-- =========================================================
DROP POLICY IF EXISTS "short_links_select_public" ON public.short_links;

CREATE POLICY "short_links_select_authenticated"
ON public.short_links FOR SELECT TO authenticated
USING (
  igreja_id = public.get_current_user_igreja_id()
);

-- Public RPC to resolve a slug → target URL only (no tenant info leak)
CREATE OR REPLACE FUNCTION public.resolve_short_link(_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_url
  FROM public.short_links
  WHERE slug = _slug
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_short_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_short_link(text) TO anon, authenticated;

-- =========================================================
-- 8) user_filial_access: restrict SELECT to self or admins
-- =========================================================
DROP POLICY IF EXISTS "user_filial_access_select" ON public.user_filial_access;

CREATE POLICY "user_filial_access_select"
ON public.user_filial_access FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::public.app_role)
      OR public.has_role(auth.uid(), 'admin_filial'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  )
);

-- =========================================================
-- 9) webhooks_safe: recreate with security_invoker
-- =========================================================
DROP VIEW IF EXISTS public.webhooks_safe;
CREATE VIEW public.webhooks_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  igreja_id,
  filial_id,
  tipo,
  url,
  enabled,
  CASE
    WHEN secret_encrypted IS NOT NULL
      THEN ('••••••••'::text || COALESCE(secret_hint, ''::text))
    ELSE NULL::text
  END AS secret_masked,
  (secret_encrypted IS NOT NULL) AS has_secret,
  created_at,
  updated_at
FROM public.webhooks;

GRANT SELECT ON public.webhooks_safe TO authenticated;
GRANT ALL ON public.webhooks_safe TO service_role;

-- =========================================================
-- 10) limpar_otps_expirados: set search_path
-- =========================================================
DO $$
DECLARE func_def text;
BEGIN
  -- ensure function has fixed search_path
  EXECUTE 'ALTER FUNCTION public.limpar_otps_expirados() SET search_path = public';
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;
