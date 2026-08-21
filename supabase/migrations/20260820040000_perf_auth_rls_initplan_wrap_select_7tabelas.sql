-- Fase 1 (auth_rls_initplan) das 7 tabelas que ficaram de fora das
-- migrations 20260820010000/20260820020000 por terem policy sem FOR
-- pré-existente (ver commit ad3d12a7 e memória
-- project-policies-for-clause-perdido-pendente).
--
-- Pré-requisito: migration 20260820030000_restaura_for_clause_perdido_7_tabelas
-- (branch fix-security-rls-for-clause-perdido, JÁ COM as correções do
-- review do Cursor bugbot na PR #126: lider de volta em "Admin pode
-- criar/deletar convites", TO authenticated nas 26 policies) precisa
-- já ter sido aplicada — esta migration assume o FOR e o TO já
-- corretos e só envolve auth.uid()/is_time_leader(auth.uid(), ...) em
-- `(select ...)`, igual à Fase 1 original. Timestamp posterior ao do
-- fix de segurança garante essa ordem de aplicação independente de
-- qual PR mergear primeiro (Supabase CLI aplica por timestamp).
--
-- REGENERADA depois do review do Cursor bugbot: a v1 desta migration
-- (antes do review) não tinha `TO authenticated` nas 26 policies do
-- fix de segurança. Adicionar isso quebraria os grupos de merge da
-- Fase 2 (perf_merge_*) que assumiam todas em PUBLIC — por isso esta
-- versão TAMBÉM adiciona `TO authenticated` a 2 policies FOR ALL
-- "intencionais" que ficam FORA do fix de segurança mas cujas
-- policies-irmãs específicas por ação (ex.: "Admins podem atualizar
-- relacionamentos familiares") agora são TO authenticated:
-- familias."admins_can_manage_families" e inscricoes_eventos."Admins
-- podem gerenciar inscricoes_eventos" — sem isso, ficariam num escopo
-- diferente das irmãs e a Fase 2 não conseguiria mesclar (regra:
-- nunca mesclar TO authenticated com PUBLIC). escalas."Admin gerencia
-- todas escalas"/"Lider gerencia escalas do seu time" já eram TO
-- authenticated desde a criação, não precisaram de ajuste.
--
-- Cobertura: a exclusão original (commit ad3d12a7) tirou a TABELA
-- inteira da Fase 1, não só as policies com o bug de FOR — por isso
-- esta migration recria TODAS as policies das 7 tabelas (as 26 do fix
-- de segurança + as ~15 que nunca tiveram o bug), só com o wrap de
-- performance.
--
-- Validado num Postgres 17 local restaurado do dump de produção + fix
-- de segurança (com as correções do review) aplicados em sequência:
-- 0 ocorrências de auth.uid()/is_time_leader(auth.uid(),...) sem
-- `(select ...)` remanescentes; exploit de self-delete em profiles
-- continua bloqueado; delete por admin (Todos.tsx) e criação de
-- convite por líder (EnviarConvitesDialog) continuam funcionando.

-- ==================== profiles ====================
DROP POLICY IF EXISTS "admins_can_delete_profiles" ON profiles;
CREATE POLICY "admins_can_delete_profiles" ON profiles FOR DELETE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "admins_can_create_profiles" ON profiles;
CREATE POLICY "admins_can_create_profiles" ON profiles FOR INSERT TO "authenticated" WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "members_can_create_dependents" ON profiles;
CREATE POLICY "members_can_create_dependents" ON profiles FOR INSERT WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (user_id IS NULL) AND (familia_id IS NOT NULL) AND (familia_id = get_user_familia_id((select auth.uid())))));
DROP POLICY IF EXISTS "members_can_create_family_profiles" ON profiles;
CREATE POLICY "members_can_create_family_profiles" ON profiles FOR INSERT TO "authenticated" WITH CHECK (((user_id IS NULL) OR (user_id = (select auth.uid()))));
DROP POLICY IF EXISTS "users_can_create_own_profile" ON profiles;
CREATE POLICY "users_can_create_own_profile" ON profiles FOR INSERT WITH CHECK ((((select auth.uid()) = user_id) AND ((select auth.uid()) IS NOT NULL) AND (user_id IS NOT NULL)));
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON profiles;
CREATE POLICY "users_can_insert_own_profile" ON profiles FOR INSERT TO "authenticated" WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Tecnico ver perfis da mesma igreja" ON profiles;
CREATE POLICY "Tecnico ver perfis da mesma igreja" ON profiles FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'tecnico'::app_role) AND (igreja_id = get_current_user_igreja_id())));
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON profiles;
CREATE POLICY "admins_can_view_all_profiles" ON profiles FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "members_can_view_family_members" ON profiles;
CREATE POLICY "members_can_view_family_members" ON profiles FOR SELECT USING ((((select auth.uid()) IS NOT NULL) AND ((user_id = (select auth.uid())) OR ((familia_id IS NOT NULL) AND (familia_id = get_user_familia_id((select auth.uid())))))));
DROP POLICY IF EXISTS "users_can_view_own_profile" ON profiles;
CREATE POLICY "users_can_view_own_profile" ON profiles FOR SELECT TO "authenticated" USING ((((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "admins_can_update_any_profile" ON profiles;
CREATE POLICY "admins_can_update_any_profile" ON profiles FOR UPDATE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "members_can_update_dependents" ON profiles;
CREATE POLICY "members_can_update_dependents" ON profiles FOR UPDATE USING ((((select auth.uid()) IS NOT NULL) AND (user_id IS NULL) AND (familia_id IS NOT NULL) AND (familia_id = get_user_familia_id((select auth.uid())))));
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;
CREATE POLICY "users_can_update_own_profile" ON profiles FOR UPDATE TO "authenticated" USING ((((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id)));

-- ==================== eventos_convites ====================
DROP POLICY IF EXISTS "Admin pode deletar convites" ON eventos_convites;
CREATE POLICY "Admin pode deletar convites" ON eventos_convites FOR DELETE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admin pode criar convites" ON eventos_convites;
CREATE POLICY "Admin pode criar convites" ON eventos_convites FOR INSERT TO "authenticated" WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admin e lider podem ver todos os convites" ON eventos_convites;
CREATE POLICY "Admin e lider podem ver todos os convites" ON eventos_convites FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admin pode atualizar convites" ON eventos_convites;
CREATE POLICY "Admin pode atualizar convites" ON eventos_convites FOR UPDATE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== familias ====================
DROP POLICY IF EXISTS "admins_can_manage_families" ON familias;
CREATE POLICY "admins_can_manage_families" ON familias TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem deletar relacionamentos familiares" ON familias;
CREATE POLICY "Admins podem deletar relacionamentos familiares" ON familias FOR DELETE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem criar relacionamentos familiares" ON familias;
CREATE POLICY "Admins podem criar relacionamentos familiares" ON familias FOR INSERT TO "authenticated" WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "members_can_create_family_relationships" ON familias;
CREATE POLICY "members_can_create_family_relationships" ON familias FOR INSERT WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "Admins podem ver todos os relacionamentos familiares" ON familias;
CREATE POLICY "Admins podem ver todos os relacionamentos familiares" ON familias FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem atualizar relacionamentos familiares" ON familias;
CREATE POLICY "Admins podem atualizar relacionamentos familiares" ON familias FOR UPDATE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== fornecedores ====================
DROP POLICY IF EXISTS "only_admins_can_delete_suppliers" ON fornecedores;
CREATE POLICY "only_admins_can_delete_suppliers" ON fornecedores FOR DELETE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "only_admins_treasurers_can_create_suppliers" ON fornecedores;
CREATE POLICY "only_admins_treasurers_can_create_suppliers" ON fornecedores FOR INSERT TO "authenticated" WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "only_admins_treasurers_can_view_suppliers" ON fornecedores;
CREATE POLICY "only_admins_treasurers_can_view_suppliers" ON fornecedores FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND ((select auth.uid()) IS NOT NULL) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "only_admins_treasurers_can_update_suppliers" ON fornecedores;
CREATE POLICY "only_admins_treasurers_can_update_suppliers" ON fornecedores FOR UPDATE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== inscricoes_eventos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar inscricoes_eventos" ON inscricoes_eventos;
CREATE POLICY "Admins podem gerenciar inscricoes_eventos" ON inscricoes_eventos TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem criar proprias inscricoes" ON inscricoes_eventos;
CREATE POLICY "Usuarios podem criar proprias inscricoes" ON inscricoes_eventos FOR INSERT TO "authenticated" WITH CHECK (((pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem ver proprias inscricoes" ON inscricoes_eventos;
CREATE POLICY "Usuarios podem ver proprias inscricoes" ON inscricoes_eventos FOR SELECT TO "authenticated" USING (((pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== visitante_contatos ====================
DROP POLICY IF EXISTS "Admins podem deletar contatos" ON visitante_contatos;
CREATE POLICY "Admins podem deletar contatos" ON visitante_contatos FOR DELETE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem criar contatos" ON visitante_contatos;
CREATE POLICY "Admins podem criar contatos" ON visitante_contatos FOR INSERT TO "authenticated" WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem ver todos os contatos" ON visitante_contatos;
CREATE POLICY "Admins podem ver todos os contatos" ON visitante_contatos FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Church staff podem ver contatos agendados da filial" ON visitante_contatos;
CREATE POLICY "Church staff podem ver contatos agendados da filial" ON visitante_contatos FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'professor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros responsáveis podem ver seus contatos" ON visitante_contatos;
CREATE POLICY "Membros responsáveis podem ver seus contatos" ON visitante_contatos FOR SELECT TO "authenticated" USING (((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem atualizar contatos" ON visitante_contatos;
CREATE POLICY "Admins podem atualizar contatos" ON visitante_contatos FOR UPDATE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Church staff podem gerenciar contatos agendados da filial" ON visitante_contatos;
CREATE POLICY "Church staff podem gerenciar contatos agendados da filial" ON visitante_contatos FOR UPDATE USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'professor'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'professor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros responsáveis podem atualizar seus contatos" ON visitante_contatos;
CREATE POLICY "Membros responsáveis podem atualizar seus contatos" ON visitante_contatos FOR UPDATE TO "authenticated" USING (((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)));

-- ==================== escalas ====================
DROP POLICY IF EXISTS "Admin gerencia todas escalas" ON escalas;
CREATE POLICY "Admin gerencia todas escalas" ON escalas TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Lider gerencia escalas do seu time" ON escalas;
CREATE POLICY "Lider gerencia escalas do seu time" ON escalas TO "authenticated" USING ((is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros visualizam escalas" ON escalas;
CREATE POLICY "Membros visualizam escalas" ON escalas FOR SELECT TO "authenticated" USING ((true AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Voluntario confirma propria escala" ON escalas;
CREATE POLICY "Voluntario confirma propria escala" ON escalas FOR UPDATE TO "authenticated" USING (((pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((pessoa_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
