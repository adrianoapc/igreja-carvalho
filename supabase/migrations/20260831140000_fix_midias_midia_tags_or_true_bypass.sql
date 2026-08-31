-- Fix: policies de midias/midia_tags mescladas por 20260820020000 herdaram
-- um OR(true) literal (SELECT) e um OR(has_role(admin)) sem has_filial_access
-- (INSERT/UPDATE/DELETE), bypassando o tenant scoping por completo.
--
-- Causa raiz: o script que gerou 20260820020000 casou policies por NOME em
-- vez de (tabela, nome). Duas policies nunca migradas pro modelo multi-
-- tenant colaram na fusão:
--   - "Todos podem ver relações mídia-tags" (midia_tags, criada em
--     20251130060945, ANTES de igreja_id/filial_id existirem) ainda tinha
--     USING (true) -> virou o OR(true) da SELECT de midia_tags. midia_tags
--     nunca é lida por rota anônima (grep no frontend não acha nenhum uso
--     fora de telas autenticadas de admin) -- fechar geral é seguro aqui.
--   - "Admins podem gerenciar mídias" / "Membros podem ver mídias" (com
--     acento) -- ATENÇÃO, correção de uma leitura errada da 1ª versão
--     desta migration: elas NÃO são um artefato de colisão de nome. `midias`
--     É `midias_culto` renomeada (`ALTER TABLE public.midias_culto RENAME
--     TO midias`, 20251130055112) -- essas 2 policies (criadas ANTES do
--     rename, 20251130023429, antes de igreja_id/filial_id existirem)
--     sempre foram policies DE VERDADE na tabela hoje chamada `midias`,
--     carregadas pelo rename, nunca substituídas in-place quando
--     20260104060625 adicionou as versões com has_filial_access sob nomes
--     novos. "Membros podem ver mídias" (`FOR SELECT USING(true)`, sem
--     `TO`, logo PUBLIC = cobre anon E authenticated) é possivelmente o
--     que sustenta a leitura anônima de `midias` embutida no join
--     `liturgia_recursos -> midias` de `TelaoLiturgia.tsx` (rota pública
--     `/telao/liturgia/:id`, fora de qualquer AuthGate, criada no mesmo
--     commit que a policy irmã "Publico pode ver recursos liturgia" de
--     `liturgia_recursos`, 20251203233713).
--
--     DECISÃO DE PRODUTO EM ABERTO (não resolvida nesta migration -- ver
--     memória de sessão / pedir confirmação antes de reabrir):
--     rastreando a cadeia de queries de TelaoLiturgia.tsx (eventos ->
--     liturgias -> liturgia_recursos -> midias), as DUAS primeiras
--     (`eventos`, `liturgias`) já exigem sessão autenticada de verdade pra
--     passar em has_filial_access() hoje (anon puro sempre falso desde
--     20260822130000; a única policy anon de `eventos`,
--     "anon_eventos_site", exige `publicar_no_site=true AND data_evento >
--     now()`, o que não bate com um culto já em andamento). Ou seja: o
--     telão, na prática, já parece depender de o dispositivo estar com
--     sessão de staff logada no navegador (AuthGate só controla o
--     redirect da rota, não a sessão do client Supabase) -- não de
--     verdadeiro acesso anônimo. Se for esse o caso, o fix abaixo (fechar
--     geral, sem branch anon) é o correto E MAIS seguro. Se o telão
--     realmente precisar rodar sem login (kiosk), falta then reabrir esta
--     migration com uma policy `TO anon` dedicada pra `midias` (E ajustar
--     `eventos`/`liturgias` também, que já bloqueiam anon puro
--     independente desta tabela). Optei por NÃO decidir isso
--     unilateralmente aqui -- fechar o vazamento confirmado
--     (authenticated cross-tenant) agora, sem tentar adivinhar o
--     comportamento anônimo.
--
--     "Admins podem gerenciar mídias" (`USING (has_role(admin))`, sem
--     filial, sem `TO` = PUBLIC, mas sem `FOR` = `FOR ALL`) não tem uso
--     anônimo conhecido (o telão só lê) -- fechar geral é correto pro
--     INSERT/UPDATE/DELETE independente da decisão acima.
--
-- Mesma classe de vulnerabilidade do PR #135 (has_filial_access bypassada
-- por um branch que não checa o tenant).

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
  'fix 20260831140000: remove OR(true) e OR(has_role(admin)) sozinho herdados de "Membros podem ver mídias"/"Admins podem gerenciar mídias" (midias_culto, pré multi-tenant) -- decisão de manter ou não acesso anon fica em aberto, ver comentário no topo do arquivo';

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
