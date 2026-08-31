-- Fix: policies de midias/midia_tags mescladas por 20260820020000 herdaram
-- um OR(true) literal (SELECT) e um OR(has_role(admin)) sem has_filial_access
-- (INSERT/UPDATE/DELETE), bypassando o tenant scoping por completo.
--
-- Causa raiz: o script que gerou 20260820020000 casou policies por NOME em
-- vez de (tabela, nome). Duas policies nunca migradas pro modelo multi-
-- tenant colaram na fusão:
--   - "Todos podem ver relações mídia-tags" (midia_tags, criada em
--     20251130060945, ANTES de igreja_id/filial_id existirem) ainda tinha
--     USING (true) -> virou o OR(true) da SELECT de midia_tags.
--   - "Admins podem gerenciar relação mídia-tags" (midia_tags) e "Membros
--     podem ver mídias" / "Admins podem gerenciar mídias" com acento
--     (originalmente de midias_culto, nunca existiram em midias) tinham
--     USING (has_role(admin)) ou USING(true) sem has_filial_access -> viraram
--     o OR(true) e o OR(has_role(admin)) desacompanhado em midias.
--
-- Mesma classe de vulnerabilidade do PR #135 (has_filial_access bypassada
-- por um branch que não checa o tenant). Fix: dropar os merges quebrados e
-- recriar só com os branches que já checavam has_filial_access
-- corretamente (equivalentes às policies canônicas "Admins podem gerenciar
-- midia_tags"/"Todos podem ver midia_tags"/"Admins podem gerenciar
-- midias"/"Todos podem ver midias ativas" de 20260104060625).

-- ==================== midia_tags ====================
DROP POLICY IF EXISTS "perf_merge_000_select_pub" ON "public"."midia_tags";
CREATE POLICY "perf_merge_000_select_pub" ON "public"."midia_tags"
  FOR SELECT
  USING ("public"."has_filial_access"("igreja_id", "filial_id"));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."midia_tags" IS
  'fix 20260831140000: remove OR(true) herdado de "Todos podem ver relações mídia-tags" (pré multi-tenant)';

DROP POLICY IF EXISTS "perf_merge_001_insert_pub" ON "public"."midia_tags";
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."midia_tags"
  FOR INSERT
  WITH CHECK ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."midia_tags" IS
  'fix 20260831140000: remove OR(has_role(admin)) sem has_filial_access herdado de "Admins podem gerenciar relação mídia-tags"';

DROP POLICY IF EXISTS "perf_merge_002_update_pub" ON "public"."midia_tags";
CREATE POLICY "perf_merge_002_update_pub" ON "public"."midia_tags"
  FOR UPDATE
  USING ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))
  WITH CHECK ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."midia_tags" IS
  'fix 20260831140000: remove OR(has_role(admin)) sem has_filial_access herdado de "Admins podem gerenciar relação mídia-tags"';

DROP POLICY IF EXISTS "perf_merge_003_delete_pub" ON "public"."midia_tags";
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."midia_tags"
  FOR DELETE
  USING ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."midia_tags" IS
  'fix 20260831140000: remove OR(has_role(admin)) sem has_filial_access herdado de "Admins podem gerenciar relação mídia-tags"';

-- ==================== midias ====================
DROP POLICY IF EXISTS "perf_merge_000_select_pub" ON "public"."midias";
CREATE POLICY "perf_merge_000_select_pub" ON "public"."midias"
  FOR SELECT
  USING ((("ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."midias" IS
  'fix 20260831140000: remove OR(true) e OR(has_role(admin)) sozinho herdados de policies de midias_culto coladas por nome';

DROP POLICY IF EXISTS "perf_merge_001_insert_pub" ON "public"."midias";
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."midias"
  FOR INSERT
  WITH CHECK ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."midias" IS
  'fix 20260831140000: remove OR(has_role(admin)) sem has_filial_access herdado de "Admins podem gerenciar mídias" (midias_culto)';

DROP POLICY IF EXISTS "perf_merge_002_update_pub" ON "public"."midias";
CREATE POLICY "perf_merge_002_update_pub" ON "public"."midias"
  FOR UPDATE
  USING ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))
  WITH CHECK ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."midias" IS
  'fix 20260831140000: remove OR(has_role(admin)) sem has_filial_access herdado de "Admins podem gerenciar mídias" (midias_culto)';

DROP POLICY IF EXISTS "perf_merge_003_delete_pub" ON "public"."midias";
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."midias"
  FOR DELETE
  USING ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."midias" IS
  'fix 20260831140000: remove OR(has_role(admin)) sem has_filial_access herdado de "Admins podem gerenciar mídias" (midias_culto)';
