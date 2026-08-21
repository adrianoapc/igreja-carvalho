-- Fase 2 (multiple_permissive_policies) das 7 tabelas que ficaram de
-- fora da migration 20260820020000 por terem policy sem FOR
-- pré-existente (ver commit ad3d12a7 e migration
-- 20260820040000_perf_auth_rls_initplan_wrap_select_7tabelas, que já
-- fez a Fase 1 dessas mesmas tabelas).
--
-- Pré-requisitos, nesta ordem: 20260820030000_restaura_for_clause_
-- perdido_7_tabelas (branch fix-security-rls-for-clause-perdido, JÁ
-- COM as correções do review do Cursor bugbot — lider de volta em
-- eventos_convites, TO authenticated nas 26 policies) e
-- 20260820040000_perf_auth_rls_initplan_wrap_select_7tabelas (Fase 1
-- desta branch, também já com TO authenticated nas 2 policies FOR ALL
-- que ficaram fora do fix de segurança). Timestamp posterior a ambas
-- garante a ordem certa de aplicação independente de qual PR mergear
-- primeiro.
--
-- REGENERADA depois do review: como as 26 policies do fix de
-- segurança agora têm `TO authenticated` (antes eram PUBLIC), os
-- grupos de merge mudaram — várias que antes só mesclavam em escopo
-- PUBLIC agora mesclam em `TO authenticated`, e ganharam companhia de
-- policies "irmãs" que já eram `TO authenticated` desde sempre (ex.:
-- profiles."Tecnico ver perfis da mesma igreja" agora entra no merge
-- de SELECT junto com admins_can_view_all_profiles/
-- users_can_view_own_profile; escalas."Voluntario confirma propria
-- escala" agora entra no merge de UPDATE junto com as 2 policies
-- "gerencia"). Mesma regra de segurança de sempre: só mescla policies
-- com o MESMO escopo de `TO`, nunca alarga PUBLIC<->authenticated.
--
-- 18 grupos (tabela, ação, escopo) mesclados em 5 das 7 tabelas — todas
-- em escopo `TO authenticated` agora (nenhum grupo PUBLIC sobrou nas
-- tabelas tocadas, exceto profiles.perf_merge_001_insert_pub, que
-- mescla as 2 policies de member self-insert que nunca tiveram TO
-- authenticated). eventos_convites e fornecedores não tinham nenhum
-- par duplicado — ficam sem mudança.
--
-- Gerado a partir de `pg_policies` num harness com dump de produção +
-- fix de segurança (pós-review) + Fase 1 (pós-review) já aplicados.
--
-- Validado no mesmo harness: 0 policies permissivas duplicadas
-- remanescentes DENTRO DO MESMO escopo TO, 0 auth.uid()/
-- is_time_leader(auth.uid(),...) sem wrap; exploit de self-delete em
-- profiles + delete por admin (Todos.tsx) + criação de convite por
-- líder (EnviarConvitesDialog) re-testados; líder de time escala seu
-- time (não-líder bloqueado); membro cria próprio vínculo familiar
-- (usuário não-relacionado bloqueado).
--
-- Ressalva (achado de review, mesma limitação não-documentada na PR
-- #125): PUBLIC também cobre `authenticated`, então o Performance
-- Advisor ainda conta multiple_permissive_policies pro role
-- authenticated onde uma policy PUBLIC coexiste com um perf_merge_*_auth
-- na mesma ação — profiles INSERT/SELECT/UPDATE (members_can_create_
-- dependents/members_can_view_family_members/members_can_update_
-- dependents, todas PUBLIC), familias INSERT
-- (members_can_create_family_relationships, PUBLIC) e visitante_contatos
-- SELECT/UPDATE ("Church staff podem ver/gerenciar contatos agendados
-- da filial", PUBLIC). Não mesclado aqui de propósito: estreitar essas
-- policies PUBLIC pra TO authenticated exigiria confirmar que nenhum
-- caller anon/role interno do Supabase depende delas — fora do escopo
-- desta PR (mesmo motivo do "Follow-up" na migration 20260820020000).

-- ==================== profiles ====================
DROP POLICY IF EXISTS "Tecnico ver perfis da mesma igreja" ON profiles;
DROP POLICY IF EXISTS "admins_can_create_profiles" ON profiles;
DROP POLICY IF EXISTS "admins_can_update_any_profile" ON profiles;
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON profiles;
DROP POLICY IF EXISTS "members_can_create_dependents" ON profiles;
DROP POLICY IF EXISTS "members_can_create_family_profiles" ON profiles;
DROP POLICY IF EXISTS "users_can_create_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_view_own_profile" ON profiles;

-- perf_merge_000_select_auth: mescla de 'Tecnico ver perfis da mesma igreja', 'admins_can_view_all_profiles', 'users_can_view_own_profile'
CREATE POLICY "perf_merge_000_select_auth" ON profiles FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'tecnico'::app_role) AND (igreja_id = get_current_user_igreja_id())) OR (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR (((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON profiles IS 'Mesclada de: Tecnico ver perfis da mesma igreja, admins_can_view_all_profiles, users_can_view_own_profile';

-- perf_merge_001_insert_auth: mescla de 'admins_can_create_profiles', 'members_can_create_family_profiles', 'users_can_insert_own_profile'
CREATE POLICY "perf_merge_001_insert_auth" ON profiles FOR INSERT TO "authenticated" WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR ((user_id IS NULL) OR (user_id = (select auth.uid()))) OR ((select auth.uid()) = user_id)));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON profiles IS 'Mesclada de: admins_can_create_profiles, members_can_create_family_profiles, users_can_insert_own_profile';

-- perf_merge_001_insert_pub: mescla de 'members_can_create_dependents', 'users_can_create_own_profile'
CREATE POLICY "perf_merge_001_insert_pub" ON profiles FOR INSERT WITH CHECK (((((select auth.uid()) IS NOT NULL) AND (user_id IS NULL) AND (familia_id IS NOT NULL) AND (familia_id = get_user_familia_id((select auth.uid())))) OR (((select auth.uid()) = user_id) AND ((select auth.uid()) IS NOT NULL) AND (user_id IS NOT NULL))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON profiles IS 'Mesclada de: members_can_create_dependents, users_can_create_own_profile';

-- perf_merge_002_update_auth: mescla de 'admins_can_update_any_profile', 'users_can_update_own_profile'
CREATE POLICY "perf_merge_002_update_auth" ON profiles FOR UPDATE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR (((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id)))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR (((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_002_update_auth" ON profiles IS 'Mesclada de: admins_can_update_any_profile, users_can_update_own_profile';

-- ==================== familias ====================
DROP POLICY IF EXISTS "Admins podem atualizar relacionamentos familiares" ON familias;
DROP POLICY IF EXISTS "Admins podem criar relacionamentos familiares" ON familias;
DROP POLICY IF EXISTS "Admins podem deletar relacionamentos familiares" ON familias;
DROP POLICY IF EXISTS "Admins podem ver todos os relacionamentos familiares" ON familias;
DROP POLICY IF EXISTS "admins_can_manage_families" ON familias;

-- perf_merge_000_select_auth: mescla de 'admins_can_manage_families', 'Admins podem ver todos os relacionamentos familiares'
CREATE POLICY "perf_merge_000_select_auth" ON familias FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
COMMENT ON POLICY "perf_merge_000_select_auth" ON familias IS 'Mesclada de: admins_can_manage_families, Admins podem ver todos os relacionamentos familiares';

-- perf_merge_001_insert_auth: mescla de 'admins_can_manage_families', 'Admins podem criar relacionamentos familiares'
CREATE POLICY "perf_merge_001_insert_auth" ON familias FOR INSERT TO "authenticated" WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON familias IS 'Mesclada de: admins_can_manage_families, Admins podem criar relacionamentos familiares';

-- perf_merge_002_update_auth: mescla de 'admins_can_manage_families', 'Admins podem atualizar relacionamentos familiares'
CREATE POLICY "perf_merge_002_update_auth" ON familias FOR UPDATE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
COMMENT ON POLICY "perf_merge_002_update_auth" ON familias IS 'Mesclada de: admins_can_manage_families, Admins podem atualizar relacionamentos familiares';

-- perf_merge_003_delete_auth: mescla de 'admins_can_manage_families', 'Admins podem deletar relacionamentos familiares'
CREATE POLICY "perf_merge_003_delete_auth" ON familias FOR DELETE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON familias IS 'Mesclada de: admins_can_manage_families, Admins podem deletar relacionamentos familiares';

-- ==================== inscricoes_eventos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar inscricoes_eventos" ON inscricoes_eventos;
DROP POLICY IF EXISTS "Usuarios podem criar proprias inscricoes" ON inscricoes_eventos;
DROP POLICY IF EXISTS "Usuarios podem ver proprias inscricoes" ON inscricoes_eventos;

-- perf_merge_000_select_auth: mescla de 'Admins podem gerenciar inscricoes_eventos', 'Usuarios podem ver proprias inscricoes'
CREATE POLICY "perf_merge_000_select_auth" ON inscricoes_eventos FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR ((pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON inscricoes_eventos IS 'Mesclada de: Admins podem gerenciar inscricoes_eventos, Usuarios podem ver proprias inscricoes';

-- perf_merge_001_insert_auth: mescla de 'Admins podem gerenciar inscricoes_eventos', 'Usuarios podem criar proprias inscricoes'
CREATE POLICY "perf_merge_001_insert_auth" ON inscricoes_eventos FOR INSERT TO "authenticated" WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR ((pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON inscricoes_eventos IS 'Mesclada de: Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes';

-- perf_merge_002_update_auth: mescla de 'Admins podem gerenciar inscricoes_eventos' (standalone — sem policy irmã nesta ação, mas exige explosão pra não perder cobertura ao dropar a FOR ALL original)
CREATE POLICY "perf_merge_002_update_auth" ON inscricoes_eventos FOR UPDATE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
COMMENT ON POLICY "perf_merge_002_update_auth" ON inscricoes_eventos IS 'Mesclada de: Admins podem gerenciar inscricoes_eventos';

-- perf_merge_003_delete_auth: mescla de 'Admins podem gerenciar inscricoes_eventos' (standalone, mesmo motivo)
CREATE POLICY "perf_merge_003_delete_auth" ON inscricoes_eventos FOR DELETE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON inscricoes_eventos IS 'Mesclada de: Admins podem gerenciar inscricoes_eventos';

-- ==================== visitante_contatos ====================
DROP POLICY IF EXISTS "Admins podem atualizar contatos" ON visitante_contatos;
DROP POLICY IF EXISTS "Admins podem ver todos os contatos" ON visitante_contatos;
DROP POLICY IF EXISTS "Membros responsáveis podem atualizar seus contatos" ON visitante_contatos;
DROP POLICY IF EXISTS "Membros responsáveis podem ver seus contatos" ON visitante_contatos;

-- perf_merge_000_select_auth: mescla de 'Admins podem ver todos os contatos', 'Membros responsáveis podem ver seus contatos'
CREATE POLICY "perf_merge_000_select_auth" ON visitante_contatos FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR ((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON visitante_contatos IS 'Mesclada de: Admins podem ver todos os contatos, Membros responsáveis podem ver seus contatos';

-- perf_merge_002_update_auth: mescla de 'Admins podem atualizar contatos', 'Membros responsáveis podem atualizar seus contatos'
CREATE POLICY "perf_merge_002_update_auth" ON visitante_contatos FOR UPDATE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR ((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR ((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_002_update_auth" ON visitante_contatos IS 'Mesclada de: Admins podem atualizar contatos, Membros responsáveis podem atualizar seus contatos';

-- ==================== escalas ====================
DROP POLICY IF EXISTS "Admin gerencia todas escalas" ON escalas;
DROP POLICY IF EXISTS "Lider gerencia escalas do seu time" ON escalas;
DROP POLICY IF EXISTS "Membros visualizam escalas" ON escalas;
DROP POLICY IF EXISTS "Voluntario confirma propria escala" ON escalas;

-- perf_merge_000_select_auth: mescla de 'Admin gerencia todas escalas', 'Lider gerencia escalas do seu time', 'Membros visualizam escalas'
CREATE POLICY "perf_merge_000_select_auth" ON escalas FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR (is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id)) OR (true AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON escalas IS 'Mesclada de: Admin gerencia todas escalas, Lider gerencia escalas do seu time, Membros visualizam escalas';

-- perf_merge_001_insert_auth: mescla de 'Admin gerencia todas escalas', 'Lider gerencia escalas do seu time'
CREATE POLICY "perf_merge_001_insert_auth" ON escalas FOR INSERT TO "authenticated" WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR (is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON escalas IS 'Mesclada de: Admin gerencia todas escalas, Lider gerencia escalas do seu time';

-- perf_merge_002_update_auth: mescla de 'Admin gerencia todas escalas', 'Lider gerencia escalas do seu time', 'Voluntario confirma propria escala'
CREATE POLICY "perf_merge_002_update_auth" ON escalas FOR UPDATE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR (is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id)) OR ((pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR (is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id)) OR ((pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_002_update_auth" ON escalas IS 'Mesclada de: Admin gerencia todas escalas, Lider gerencia escalas do seu time, Voluntario confirma propria escala';

-- perf_merge_003_delete_auth: mescla de 'Admin gerencia todas escalas', 'Lider gerencia escalas do seu time'
CREATE POLICY "perf_merge_003_delete_auth" ON escalas FOR DELETE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)) OR (is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON escalas IS 'Mesclada de: Admin gerencia todas escalas, Lider gerencia escalas do seu time';
