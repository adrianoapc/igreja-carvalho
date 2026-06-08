
-- 1. chatbot_configs
DROP POLICY IF EXISTS "Leitura publica configs chatbot" ON public.chatbot_configs;

-- 2. liturgias
DROP POLICY IF EXISTS "Membros visualizam liturgias" ON public.liturgias;

-- 3. notificacao_regras
DROP POLICY IF EXISTS "Leitura publica regras" ON public.notificacao_regras;

-- 4. testes_ministerio
DROP POLICY IF EXISTS "Testes ativos são públicos" ON public.testes_ministerio;
CREATE POLICY "Testes ativos visiveis na igreja"
ON public.testes_ministerio
FOR SELECT
TO authenticated
USING (
  ativo = true
  AND (
    igreja_id IS NULL
    OR igreja_id = public.get_current_user_igreja_id()
  )
);

-- 5. short_links
DROP POLICY IF EXISTS "short_links_select_public" ON public.short_links;
CREATE POLICY "short_links_select_same_church"
ON public.short_links
FOR SELECT
TO authenticated
USING (
  igreja_id = public.get_current_user_igreja_id()
  AND (expires_at IS NULL OR expires_at > now())
);
REVOKE SELECT ON public.short_links FROM anon;

-- 6. webhooks: drop plaintext secret column + recreate safe view
DROP VIEW IF EXISTS public.webhooks_safe;

ALTER TABLE public.webhooks DROP COLUMN IF EXISTS secret;

CREATE VIEW public.webhooks_safe AS
SELECT
  id,
  igreja_id,
  filial_id,
  tipo,
  url,
  enabled,
  CASE
    WHEN secret_encrypted IS NOT NULL THEN '••••••••'::text || COALESCE(secret_hint, ''::text)
    ELSE NULL::text
  END AS secret_masked,
  CASE
    WHEN secret_encrypted IS NOT NULL THEN true
    ELSE false
  END AS has_secret,
  created_at,
  updated_at
FROM public.webhooks;

GRANT SELECT ON public.webhooks_safe TO authenticated;

-- Restrict SELECT on webhooks to admin/super_admin within church
DROP POLICY IF EXISTS "Igreja pode ver webhooks" ON public.webhooks;
CREATE POLICY "Admins podem ver webhooks"
ON public.webhooks
FOR SELECT
TO authenticated
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  AND (
    igreja_id IS NULL
    OR igreja_id IN (
      SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- 7. Fix profiles.id = auth.uid() bug
-- sessoes_contagem
DROP POLICY IF EXISTS "sessoes_contagem_select_same_church" ON public.sessoes_contagem;
CREATE POLICY "sessoes_contagem_select_same_church"
ON public.sessoes_contagem
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.igreja_id = sessoes_contagem.igreja_id
  )
);

-- contagens
DROP POLICY IF EXISTS "contagens_select_same_church" ON public.contagens;
CREATE POLICY "contagens_select_same_church"
ON public.contagens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sessoes_contagem s
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE s.id = contagens.sessao_id AND p.igreja_id = s.igreja_id
  )
);

DROP POLICY IF EXISTS "contagens_insert_conferente_or_admin" ON public.contagens;
CREATE POLICY "contagens_insert_conferente_or_admin"
ON public.contagens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessoes_contagem s
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE s.id = contagens.sessao_id AND p.igreja_id = s.igreja_id
  )
);

-- auditoria_conciliacoes
DROP POLICY IF EXISTS "Users can view audit logs from same church" ON public.auditoria_conciliacoes;
CREATE POLICY "Users can view audit logs from same church"
ON public.auditoria_conciliacoes
FOR SELECT
TO authenticated
USING (
  igreja_id = (
    SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

DROP POLICY IF EXISTS "Users can insert audit logs for their church" ON public.auditoria_conciliacoes;
CREATE POLICY "Users can insert audit logs for their church"
ON public.auditoria_conciliacoes
FOR INSERT
TO authenticated
WITH CHECK (
  igreja_id = (
    SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

-- webhooks DML
DROP POLICY IF EXISTS "Admins podem atualizar webhooks" ON public.webhooks;
CREATE POLICY "Admins podem atualizar webhooks"
ON public.webhooks
FOR UPDATE
TO authenticated
USING (
  igreja_id IS NOT NULL
  AND igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
)
WITH CHECK (
  igreja_id IS NOT NULL
  AND igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins podem deletar webhooks" ON public.webhooks;
CREATE POLICY "Admins podem deletar webhooks"
ON public.webhooks
FOR DELETE
TO authenticated
USING (
  igreja_id IS NOT NULL
  AND igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins podem inserir webhooks" ON public.webhooks;
CREATE POLICY "Admins podem inserir webhooks"
ON public.webhooks
FOR INSERT
TO authenticated
WITH CHECK (
  igreja_id IS NOT NULL
  AND igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Super admin pode gerenciar webhooks" ON public.webhooks;
CREATE POLICY "Super admin pode gerenciar webhooks"
ON public.webhooks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
  )
);

-- whatsapp_numeros
DROP POLICY IF EXISTS "Admins podem atualizar whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Admins podem atualizar whatsapp numeros"
ON public.whatsapp_numeros
FOR UPDATE
TO authenticated
USING (
  igreja_id IS NOT NULL
  AND igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
)
WITH CHECK (
  igreja_id IS NOT NULL
  AND igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins podem inserir whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Admins podem inserir whatsapp numeros"
ON public.whatsapp_numeros
FOR INSERT
TO authenticated
WITH CHECK (
  igreja_id IS NOT NULL
  AND igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins podem remover whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Admins podem remover whatsapp numeros"
ON public.whatsapp_numeros
FOR DELETE
TO authenticated
USING (
  igreja_id IS NOT NULL
  AND igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Igreja pode ver whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Igreja pode ver whatsapp numeros"
ON public.whatsapp_numeros
FOR SELECT
TO authenticated
USING (
  igreja_id IS NULL
  OR igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Super admin pode gerenciar whatsapp numeros" ON public.whatsapp_numeros;
CREATE POLICY "Super admin pode gerenciar whatsapp numeros"
ON public.whatsapp_numeros
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
  )
);

-- evento_lista_espera
DROP POLICY IF EXISTS "Igreja members can view lista espera" ON public.evento_lista_espera;
CREATE POLICY "Igreja members can view lista espera"
ON public.evento_lista_espera
FOR SELECT
TO authenticated
USING (
  igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Igreja members can insert lista espera" ON public.evento_lista_espera;
CREATE POLICY "Igreja members can insert lista espera"
ON public.evento_lista_espera
FOR INSERT
TO authenticated
WITH CHECK (
  igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Igreja members can update lista espera" ON public.evento_lista_espera;
CREATE POLICY "Igreja members can update lista espera"
ON public.evento_lista_espera
FOR UPDATE
TO authenticated
USING (
  igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Igreja members can delete lista espera" ON public.evento_lista_espera;
CREATE POLICY "Igreja members can delete lista espera"
ON public.evento_lista_espera
FOR DELETE
TO authenticated
USING (
  igreja_id IN (SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- financeiro_config
DROP POLICY IF EXISTS "financeiro_config_select_same_church" ON public.financeiro_config;
CREATE POLICY "financeiro_config_select_same_church"
ON public.financeiro_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.igreja_id = financeiro_config.igreja_id
  )
);
