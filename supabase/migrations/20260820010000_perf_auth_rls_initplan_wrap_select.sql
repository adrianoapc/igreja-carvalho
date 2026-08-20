-- Fase 1 do achado de performance auth_rls_initplan (Supabase Performance
-- Advisor — ver memoria project-supabase-linter-performance-pendente).
-- Envolve chamadas diretas a auth.uid()/auth.role()/auth.jwt()/current_setting()
-- em `(select ...)` para que o Postgres resolva uma vez por STATEMENT em vez de
-- uma vez por LINHA. Puramente mecanico: nao muda semantica das policies,
-- so performance — nenhuma policy trocou USING/WITH CHECK, TO ou FOR.
--
-- REGENERADA em 2026-08-20 em cima do schema JA COM a PR #124 aplicada
-- (fecha escrita/leitura anonima cross-tenant em eventos/cancoes_culto/
-- escalas/liturgia_culto/membros_time/midias_culto/posicoes_time/times/
-- times_culto — ver migration 20260820000000). A geracao original desta
-- fase (branch fix-perf-auth-rls-initplan, commit 6460cc56) rodou ANTES
-- da PR #124 e recriava a versao vulneravel de "Membros podem ver times
-- ativos" em `times` (sem TO authenticated) — regenerar contra o dump
-- pos-fix elimina esse risco. 341 policies tocadas (340 + a nova "Lider
-- gerencia posições do seu time" da PR #124). Validado num Postgres
-- local (Docker) restaurado de `supabase db dump --linked -s public`:
-- 0 ocorrencias de auth.uid()/auth.role()/auth.jwt()/current_setting()
-- sem `(select ...)` remanescentes; TO/FOR das 9 policies da PR #124
-- confirmados intactos; exploit de escrita/leitura anonima (SET ROLE
-- anon sem NENHUM JWT) re-testado e continua bloqueado.


-- ==================== agenda_pastoral ====================
DROP POLICY IF EXISTS "Admin e secretario podem deletar agenda" ON "public"."agenda_pastoral";
CREATE POLICY "Admin e secretario podem deletar agenda" ON "public"."agenda_pastoral" FOR DELETE USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Staff pode atualizar agenda pastoral" ON "public"."agenda_pastoral";
CREATE POLICY "Staff pode atualizar agenda pastoral" ON "public"."agenda_pastoral" FOR UPDATE USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role) OR (has_role((select auth.uid()), 'pastor'::app_role) AND (pastor_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Staff pode criar agenda pastoral" ON "public"."agenda_pastoral";
CREATE POLICY "Staff pode criar agenda pastoral" ON "public"."agenda_pastoral" FOR INSERT WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Staff pode ver agenda pastoral" ON "public"."agenda_pastoral";
CREATE POLICY "Staff pode ver agenda pastoral" ON "public"."agenda_pastoral" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== alteracoes_perfil_pendentes ====================
DROP POLICY IF EXISTS "Admins can update pending changes" ON "public"."alteracoes_perfil_pendentes";
CREATE POLICY "Admins can update pending changes" ON "public"."alteracoes_perfil_pendentes" FOR UPDATE USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins can view pending changes" ON "public"."alteracoes_perfil_pendentes";
CREATE POLICY "Admins can view pending changes" ON "public"."alteracoes_perfil_pendentes" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== app_config ====================
DROP POLICY IF EXISTS "Admin e Tecnico gerenciam config" ON "public"."app_config";
CREATE POLICY "Admin e Tecnico gerenciam config" ON "public"."app_config" FOR UPDATE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tecnico'::app_role)));

-- ==================== app_permissions ====================
DROP POLICY IF EXISTS "Admins podem gerenciar permissões" ON "public"."app_permissions";
CREATE POLICY "Admins podem gerenciar permissões" ON "public"."app_permissions" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== app_roles ====================
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON "public"."app_roles";
CREATE POLICY "Admins podem gerenciar roles" ON "public"."app_roles" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== atendimentos_bot ====================
DROP POLICY IF EXISTS "Admins podem gerenciar atendimentos" ON "public"."atendimentos_bot";
CREATE POLICY "Admins podem gerenciar atendimentos" ON "public"."atendimentos_bot" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Intercessores podem ver atendimentos" ON "public"."atendimentos_bot";
CREATE POLICY "Intercessores podem ver atendimentos" ON "public"."atendimentos_bot" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM intercessores
  WHERE ((intercessores.user_id = (select auth.uid())) AND (intercessores.ativo = true)))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== atendimentos_pastorais ====================
DROP POLICY IF EXISTS "Pastores e admins gerenciam atendimentos pastorais" ON "public"."atendimentos_pastorais";
CREATE POLICY "Pastores e admins gerenciam atendimentos pastorais" ON "public"."atendimentos_pastorais" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Secretarios podem ver agenda" ON "public"."atendimentos_pastorais";
CREATE POLICY "Secretarios podem ver agenda" ON "public"."atendimentos_pastorais" FOR SELECT USING ((has_role((select auth.uid()), 'secretario'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== audit_public_endpoints ====================
DROP POLICY IF EXISTS "Admins can view audit logs" ON "public"."audit_public_endpoints";
CREATE POLICY "Admins can view audit logs" ON "public"."audit_public_endpoints" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = ANY (ARRAY['admin'::app_role, 'pastor'::app_role]))))));

-- ==================== auditoria_conciliacoes ====================
DROP POLICY IF EXISTS "Users can insert audit logs for their church" ON "public"."auditoria_conciliacoes";
CREATE POLICY "Users can insert audit logs for their church" ON "public"."auditoria_conciliacoes" FOR INSERT TO "authenticated" WITH CHECK ((igreja_id = ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid()))
 LIMIT 1)));
DROP POLICY IF EXISTS "Users can view audit logs from same church" ON "public"."auditoria_conciliacoes";
CREATE POLICY "Users can view audit logs from same church" ON "public"."auditoria_conciliacoes" FOR SELECT TO "authenticated" USING ((igreja_id = ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid()))
 LIMIT 1)));

-- ==================== aulas ====================
DROP POLICY IF EXISTS "Admins podem gerenciar aulas" ON "public"."aulas";
CREATE POLICY "Admins podem gerenciar aulas" ON "public"."aulas" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== banners ====================
DROP POLICY IF EXISTS "Admins podem atualizar banners" ON "public"."banners";
CREATE POLICY "Admins podem atualizar banners" ON "public"."banners" FOR UPDATE USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem criar banners" ON "public"."banners";
CREATE POLICY "Admins podem criar banners" ON "public"."banners" FOR INSERT WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem deletar banners" ON "public"."banners";
CREATE POLICY "Admins podem deletar banners" ON "public"."banners" FOR DELETE USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Todos podem ver banners no período" ON "public"."banners";
CREATE POLICY "Todos podem ver banners no período" ON "public"."banners" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR is_banner_active(active, scheduled_at, expires_at)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== bases_ministeriais ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar bases ministeriais" ON "public"."bases_ministeriais";
CREATE POLICY "Admins e tesoureiros podem gerenciar bases ministeriais" ON "public"."bases_ministeriais" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem ver bases ministeriais da igreja" ON "public"."bases_ministeriais";
CREATE POLICY "Usuarios podem ver bases ministeriais da igreja" ON "public"."bases_ministeriais" FOR SELECT USING ((((select auth.uid()) IS NOT NULL) AND (ativo = true) AND has_filial_access(igreja_id, filial_id)));

-- ==================== blocked_ips ====================
DROP POLICY IF EXISTS "Admins can view blocked IPs" ON "public"."blocked_ips";
CREATE POLICY "Admins can view blocked IPs" ON "public"."blocked_ips" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = ANY (ARRAY['admin'::app_role, 'pastor'::app_role]))))));

-- ==================== cancoes_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar canções" ON "public"."cancoes_culto";
CREATE POLICY "Admins podem gerenciar canções" ON "public"."cancoes_culto" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== candidatos_voluntario ====================
DROP POLICY IF EXISTS "Admins podem gerenciar candidatos" ON "public"."candidatos_voluntario";
CREATE POLICY "Admins podem gerenciar candidatos" ON "public"."candidatos_voluntario" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Ver própria candidatura" ON "public"."candidatos_voluntario";
CREATE POLICY "Ver própria candidatura" ON "public"."candidatos_voluntario" FOR SELECT USING (((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== candidatos_voluntario_historico ====================
DROP POLICY IF EXISTS "Admins e líderes podem ver histórico" ON "public"."candidatos_voluntario_historico";
CREATE POLICY "Admins e líderes podem ver histórico" ON "public"."candidatos_voluntario_historico" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== categorias_financeiras ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar categorias" ON "public"."categorias_financeiras";
CREATE POLICY "Admins e tesoureiros podem gerenciar categorias" ON "public"."categorias_financeiras" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem ver categorias da igreja" ON "public"."categorias_financeiras";
CREATE POLICY "Usuarios podem ver categorias da igreja" ON "public"."categorias_financeiras" FOR SELECT USING ((((select auth.uid()) IS NOT NULL) AND (ativo = true) AND has_filial_access(igreja_id, filial_id)));

-- ==================== categorias_times ====================
DROP POLICY IF EXISTS "Admins podem gerenciar categorias" ON "public"."categorias_times";
CREATE POLICY "Admins podem gerenciar categorias" ON "public"."categorias_times" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Todos podem ver categorias ativas" ON "public"."categorias_times";
CREATE POLICY "Todos podem ver categorias ativas" ON "public"."categorias_times" FOR SELECT USING ((((ativo = true) OR has_role((select auth.uid()), 'admin'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== centros_custo ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar centros de custo" ON "public"."centros_custo";
CREATE POLICY "Admins e tesoureiros podem gerenciar centros de custo" ON "public"."centros_custo" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem ver centros custo da igreja" ON "public"."centros_custo";
CREATE POLICY "Usuarios podem ver centros custo da igreja" ON "public"."centros_custo" FOR SELECT USING ((((select auth.uid()) IS NOT NULL) AND (ativo = true) AND has_filial_access(igreja_id, filial_id)));

-- ==================== chatbot_configs ====================
DROP POLICY IF EXISTS "Admins podem gerenciar configs chatbot" ON "public"."chatbot_configs";
CREATE POLICY "Admins podem gerenciar configs chatbot" ON "public"."chatbot_configs" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== checkins ====================
DROP POLICY IF EXISTS "Lideres gerenciam checkins" ON "public"."checkins";
CREATE POLICY "Lideres gerenciam checkins" ON "public"."checkins" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros podem ver checkins" ON "public"."checkins";
CREATE POLICY "Membros podem ver checkins" ON "public"."checkins" FOR SELECT USING ((((select auth.uid()) IS NOT NULL) AND has_filial_access(igreja_id, filial_id)));

-- ==================== cob_pix ====================
DROP POLICY IF EXISTS "Users can insert cobranças PIX for their church" ON "public"."cob_pix";
CREATE POLICY "Users can insert cobranças PIX for their church" ON "public"."cob_pix" FOR INSERT WITH CHECK ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Users can update cobranças PIX from their church" ON "public"."cob_pix";
CREATE POLICY "Users can update cobranças PIX from their church" ON "public"."cob_pix" FOR UPDATE USING ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))))) WITH CHECK ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Users can view cobranças PIX from their church" ON "public"."cob_pix";
CREATE POLICY "Users can view cobranças PIX from their church" ON "public"."cob_pix" FOR SELECT USING ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== comunicados ====================
DROP POLICY IF EXISTS "comunicados_gestao_admin" ON "public"."comunicados";
CREATE POLICY "comunicados_gestao_admin" ON "public"."comunicados" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== conciliacao_ml_feedback ====================
DROP POLICY IF EXISTS "Finance team insert ML feedback" ON "public"."conciliacao_ml_feedback";
CREATE POLICY "Finance team insert ML feedback" ON "public"."conciliacao_ml_feedback" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Users can view conciliação ML feedback from their church" ON "public"."conciliacao_ml_feedback";
CREATE POLICY "Users can view conciliação ML feedback from their church" ON "public"."conciliacao_ml_feedback" FOR SELECT USING ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== conciliacao_ml_sugestoes ====================
DROP POLICY IF EXISTS "Finance team insert ML sugestoes" ON "public"."conciliacao_ml_sugestoes";
CREATE POLICY "Finance team insert ML sugestoes" ON "public"."conciliacao_ml_sugestoes" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team update ML sugestoes" ON "public"."conciliacao_ml_sugestoes";
CREATE POLICY "Finance team update ML sugestoes" ON "public"."conciliacao_ml_sugestoes" FOR UPDATE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Users can view conciliação ML sugestões from their church" ON "public"."conciliacao_ml_sugestoes";
CREATE POLICY "Users can view conciliação ML sugestões from their church" ON "public"."conciliacao_ml_sugestoes" FOR SELECT USING ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== conciliacoes_divisao ====================
DROP POLICY IF EXISTS "Finance team delete divisoes" ON "public"."conciliacoes_divisao";
CREATE POLICY "Finance team delete divisoes" ON "public"."conciliacoes_divisao" FOR DELETE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team insert divisoes" ON "public"."conciliacoes_divisao";
CREATE POLICY "Finance team insert divisoes" ON "public"."conciliacoes_divisao" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team update divisoes" ON "public"."conciliacoes_divisao";
CREATE POLICY "Finance team update divisoes" ON "public"."conciliacoes_divisao" FOR UPDATE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Users can view their church divisoes" ON "public"."conciliacoes_divisao";
CREATE POLICY "Users can view their church divisoes" ON "public"."conciliacoes_divisao" FOR SELECT USING ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== conciliacoes_divisao_transacoes ====================
DROP POLICY IF EXISTS "Finance team delete divisao transacoes" ON "public"."conciliacoes_divisao_transacoes";
CREATE POLICY "Finance team delete divisao transacoes" ON "public"."conciliacoes_divisao_transacoes" FOR DELETE TO "authenticated" USING (((conciliacao_divisao_id IN ( SELECT conciliacoes_divisao.id
   FROM conciliacoes_divisao
  WHERE (conciliacoes_divisao.igreja_id IN ( SELECT profiles.igreja_id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid())))))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team insert divisao transacoes" ON "public"."conciliacoes_divisao_transacoes";
CREATE POLICY "Finance team insert divisao transacoes" ON "public"."conciliacoes_divisao_transacoes" FOR INSERT TO "authenticated" WITH CHECK (((conciliacao_divisao_id IN ( SELECT conciliacoes_divisao.id
   FROM conciliacoes_divisao
  WHERE (conciliacoes_divisao.igreja_id IN ( SELECT profiles.igreja_id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid())))))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Users can view divisao transacoes" ON "public"."conciliacoes_divisao_transacoes";
CREATE POLICY "Users can view divisao transacoes" ON "public"."conciliacoes_divisao_transacoes" FOR SELECT USING ((conciliacao_divisao_id IN ( SELECT conciliacoes_divisao.id
   FROM conciliacoes_divisao
  WHERE (conciliacoes_divisao.igreja_id IN ( SELECT profiles.igreja_id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid())))))));

-- ==================== conciliacoes_lote ====================
DROP POLICY IF EXISTS "Finance team can delete lotes" ON "public"."conciliacoes_lote";
CREATE POLICY "Finance team can delete lotes" ON "public"."conciliacoes_lote" FOR DELETE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team can insert lotes" ON "public"."conciliacoes_lote";
CREATE POLICY "Finance team can insert lotes" ON "public"."conciliacoes_lote" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team can update lotes" ON "public"."conciliacoes_lote";
CREATE POLICY "Finance team can update lotes" ON "public"."conciliacoes_lote" FOR UPDATE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar lotes da sua igreja" ON "public"."conciliacoes_lote";
CREATE POLICY "Usuários autenticados podem visualizar lotes da sua igreja" ON "public"."conciliacoes_lote" FOR SELECT USING (((select auth.uid()) IN ( SELECT profiles.user_id
   FROM profiles
  WHERE (profiles.igreja_id = conciliacoes_lote.igreja_id))));

-- ==================== conciliacoes_lote_extratos ====================
DROP POLICY IF EXISTS "Finance team can delete lote_extratos" ON "public"."conciliacoes_lote_extratos";
CREATE POLICY "Finance team can delete lote_extratos" ON "public"."conciliacoes_lote_extratos" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM conciliacoes_lote cl
  WHERE ((cl.id = conciliacoes_lote_extratos.conciliacao_lote_id) AND (cl.igreja_id IN ( SELECT profiles.igreja_id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid()))))))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team can insert lote_extratos" ON "public"."conciliacoes_lote_extratos";
CREATE POLICY "Finance team can insert lote_extratos" ON "public"."conciliacoes_lote_extratos" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM conciliacoes_lote cl
  WHERE ((cl.id = conciliacoes_lote_extratos.conciliacao_lote_id) AND (cl.igreja_id IN ( SELECT profiles.igreja_id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid()))))))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Usuários podem visualizar vínculos de lotes da sua igreja" ON "public"."conciliacoes_lote_extratos";
CREATE POLICY "Usuários podem visualizar vínculos de lotes da sua igreja" ON "public"."conciliacoes_lote_extratos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM conciliacoes_lote cl
  WHERE ((cl.id = conciliacoes_lote_extratos.conciliacao_lote_id) AND ((select auth.uid()) IN ( SELECT profiles.user_id
           FROM profiles
          WHERE (profiles.igreja_id = cl.igreja_id)))))));

-- ==================== configuracoes_financeiro ====================
DROP POLICY IF EXISTS "Admin/Tesoureiro gerenciam config da própria igreja" ON "public"."configuracoes_financeiro";
CREATE POLICY "Admin/Tesoureiro gerenciam config da própria igreja" ON "public"."configuracoes_financeiro" TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== configuracoes_igreja ====================
DROP POLICY IF EXISTS "Admins podem atualizar configuracoes" ON "public"."configuracoes_igreja";
CREATE POLICY "Admins podem atualizar configuracoes" ON "public"."configuracoes_igreja" FOR UPDATE USING ((has_role((select auth.uid()), 'admin'::app_role) AND (igreja_id = (NULLIF((select current_setting('request.jwt.claim.igreja_id'::text, true)), ''::text))::uuid))) WITH CHECK ((igreja_id = (NULLIF((select current_setting('request.jwt.claim.igreja_id'::text, true)), ''::text))::uuid));
DROP POLICY IF EXISTS "Igreja pode ver configuracoes" ON "public"."configuracoes_igreja";
CREATE POLICY "Igreja pode ver configuracoes" ON "public"."configuracoes_igreja" FOR SELECT USING ((igreja_id = (NULLIF((select current_setting('request.jwt.claim.igreja_id'::text, true)), ''::text))::uuid));
DROP POLICY IF EXISTS "Usuários autenticados veem config da sua igreja" ON "public"."configuracoes_igreja";
CREATE POLICY "Usuários autenticados veem config da sua igreja" ON "public"."configuracoes_igreja" FOR SELECT TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin'::app_role)));

-- ==================== contagens ====================
DROP POLICY IF EXISTS "contagens_insert_conferente_or_admin" ON "public"."contagens";
CREATE POLICY "contagens_insert_conferente_or_admin" ON "public"."contagens" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (sessoes_contagem s
     JOIN profiles p ON ((p.user_id = (select auth.uid()))))
  WHERE ((s.id = contagens.sessao_id) AND (p.igreja_id = s.igreja_id)))));
DROP POLICY IF EXISTS "contagens_select_same_church" ON "public"."contagens";
CREATE POLICY "contagens_select_same_church" ON "public"."contagens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (sessoes_contagem s
     JOIN profiles p ON ((p.user_id = (select auth.uid()))))
  WHERE ((s.id = contagens.sessao_id) AND (p.igreja_id = s.igreja_id)))));

-- ==================== contas ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar contas" ON "public"."contas";
CREATE POLICY "Admins e tesoureiros podem gerenciar contas" ON "public"."contas" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== cultos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar cultos" ON "public"."cultos";
CREATE POLICY "Admins podem gerenciar cultos" ON "public"."cultos" TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== edge_function_config ====================
DROP POLICY IF EXISTS "Admins podem atualizar configurações" ON "public"."edge_function_config";
CREATE POLICY "Admins podem atualizar configurações" ON "public"."edge_function_config" FOR UPDATE USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins podem ver configurações" ON "public"."edge_function_config";
CREATE POLICY "Admins podem ver configurações" ON "public"."edge_function_config" FOR SELECT USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== edge_function_logs ====================
DROP POLICY IF EXISTS "Admins podem visualizar logs" ON "public"."edge_function_logs";
CREATE POLICY "Admins podem visualizar logs" ON "public"."edge_function_logs" FOR SELECT TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== escalas ====================
DROP POLICY IF EXISTS "Admin gerencia todas escalas" ON "public"."escalas";
CREATE POLICY "Admin gerencia todas escalas" ON "public"."escalas" TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Lider gerencia escalas do seu time" ON "public"."escalas";
CREATE POLICY "Lider gerencia escalas do seu time" ON "public"."escalas" TO "authenticated" USING ((is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Voluntario confirma propria escala" ON "public"."escalas";
CREATE POLICY "Voluntario confirma propria escala" ON "public"."escalas" USING (((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== escalas_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar escalas" ON "public"."escalas_culto";
CREATE POLICY "Admins podem gerenciar escalas" ON "public"."escalas_culto" TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== escalas_template ====================
DROP POLICY IF EXISTS "Admins podem gerenciar escalas de templates" ON "public"."escalas_template";
CREATE POLICY "Admins podem gerenciar escalas de templates" ON "public"."escalas_template" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros podem ver escalas de templates ativos" ON "public"."escalas_template";
CREATE POLICY "Membros podem ver escalas de templates ativos" ON "public"."escalas_template" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM templates_culto
  WHERE ((templates_culto.id = escalas_template.template_id) AND ((templates_culto.ativo = true) OR has_role((select auth.uid()), 'admin'::app_role))))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== etapas_jornada ====================
DROP POLICY IF EXISTS "Admins podem gerenciar etapas" ON "public"."etapas_jornada";
CREATE POLICY "Admins podem gerenciar etapas" ON "public"."etapas_jornada" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Etapas visiveis na igreja" ON "public"."etapas_jornada";
CREATE POLICY "Etapas visiveis na igreja" ON "public"."etapas_jornada" FOR SELECT TO "authenticated" USING ((igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))));

-- ==================== evento_lista_espera ====================
DROP POLICY IF EXISTS "Igreja members can delete lista espera" ON "public"."evento_lista_espera";
CREATE POLICY "Igreja members can delete lista espera" ON "public"."evento_lista_espera" FOR DELETE TO "authenticated" USING ((igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Igreja members can insert lista espera" ON "public"."evento_lista_espera";
CREATE POLICY "Igreja members can insert lista espera" ON "public"."evento_lista_espera" FOR INSERT TO "authenticated" WITH CHECK ((igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Igreja members can update lista espera" ON "public"."evento_lista_espera";
CREATE POLICY "Igreja members can update lista espera" ON "public"."evento_lista_espera" FOR UPDATE TO "authenticated" USING ((igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Igreja members can view lista espera" ON "public"."evento_lista_espera";
CREATE POLICY "Igreja members can view lista espera" ON "public"."evento_lista_espera" FOR SELECT TO "authenticated" USING ((igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Service role full access lista espera" ON "public"."evento_lista_espera";
CREATE POLICY "Service role full access lista espera" ON "public"."evento_lista_espera" USING (((select auth.role()) = 'service_role'::text));

-- ==================== evento_lotes ====================
DROP POLICY IF EXISTS "Admins podem gerenciar evento_lotes" ON "public"."evento_lotes";
CREATE POLICY "Admins podem gerenciar evento_lotes" ON "public"."evento_lotes" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== evento_subtipos ====================
DROP POLICY IF EXISTS "Admin gerencia subtipos" ON "public"."evento_subtipos";
CREATE POLICY "Admin gerencia subtipos" ON "public"."evento_subtipos" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Subtipos visiveis na igreja" ON "public"."evento_subtipos";
CREATE POLICY "Subtipos visiveis na igreja" ON "public"."evento_subtipos" FOR SELECT TO "authenticated" USING ((igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))));

-- ==================== eventos ====================
DROP POLICY IF EXISTS "Admin gerencia eventos" ON "public"."eventos";
CREATE POLICY "Admin gerencia eventos" ON "public"."eventos" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== eventos_convites ====================
DROP POLICY IF EXISTS "Admin e lider podem ver todos os convites" ON "public"."eventos_convites";
CREATE POLICY "Admin e lider podem ver todos os convites" ON "public"."eventos_convites" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admin pode atualizar convites" ON "public"."eventos_convites";
CREATE POLICY "Admin pode atualizar convites" ON "public"."eventos_convites" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admin pode criar convites" ON "public"."eventos_convites";
CREATE POLICY "Admin pode criar convites" ON "public"."eventos_convites" WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admin pode deletar convites" ON "public"."eventos_convites";
CREATE POLICY "Admin pode deletar convites" ON "public"."eventos_convites" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== extratos_bancarios ====================
DROP POLICY IF EXISTS "Atualizar extratos bancarios" ON "public"."extratos_bancarios";
CREATE POLICY "Atualizar extratos bancarios" ON "public"."extratos_bancarios" FOR UPDATE TO "authenticated" USING (((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND (igreja_id = get_jwt_igreja_id()) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND (igreja_id = get_jwt_igreja_id()) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Deletar extratos bancarios" ON "public"."extratos_bancarios";
CREATE POLICY "Deletar extratos bancarios" ON "public"."extratos_bancarios" FOR DELETE TO "authenticated" USING (((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin'::app_role)) AND (igreja_id = get_jwt_igreja_id()) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Inserir extratos bancarios" ON "public"."extratos_bancarios";
CREATE POLICY "Inserir extratos bancarios" ON "public"."extratos_bancarios" FOR INSERT TO "authenticated" WITH CHECK (((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND (igreja_id = get_jwt_igreja_id()) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Ver extratos bancarios" ON "public"."extratos_bancarios";
CREATE POLICY "Ver extratos bancarios" ON "public"."extratos_bancarios" FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND (igreja_id = get_jwt_igreja_id()) AND has_filial_access(igreja_id, filial_id)));

-- ==================== familias ====================
DROP POLICY IF EXISTS "Admins podem atualizar relacionamentos familiares" ON "public"."familias";
CREATE POLICY "Admins podem atualizar relacionamentos familiares" ON "public"."familias" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem criar relacionamentos familiares" ON "public"."familias";
CREATE POLICY "Admins podem criar relacionamentos familiares" ON "public"."familias" WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem deletar relacionamentos familiares" ON "public"."familias";
CREATE POLICY "Admins podem deletar relacionamentos familiares" ON "public"."familias" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem ver todos os relacionamentos familiares" ON "public"."familias";
CREATE POLICY "Admins podem ver todos os relacionamentos familiares" ON "public"."familias" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "admins_can_manage_families" ON "public"."familias";
CREATE POLICY "admins_can_manage_families" ON "public"."familias" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "members_can_create_family_relationships" ON "public"."familias";
CREATE POLICY "members_can_create_family_relationships" ON "public"."familias" FOR INSERT WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))))));

-- ==================== filiais ====================
DROP POLICY IF EXISTS "Admin igreja gerencia filiais" ON "public"."filiais";
CREATE POLICY "Admin igreja gerencia filiais" ON "public"."filiais" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role))) WITH CHECK (((igreja_id = get_jwt_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role))));
DROP POLICY IF EXISTS "Igreja admin pode gerenciar filiais" ON "public"."filiais";
CREATE POLICY "Igreja admin pode gerenciar filiais" ON "public"."filiais" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'super_admin'::app_role)))) OR ((igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = ANY (ARRAY['admin'::app_role, 'pastor'::app_role])))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'super_admin'::app_role)))) OR ((igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))) AND (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = ANY (ARRAY['admin'::app_role, 'pastor'::app_role]))))))));
DROP POLICY IF EXISTS "Usuários autenticados veem filiais da sua igreja" ON "public"."filiais";
CREATE POLICY "Usuários autenticados veem filiais da sua igreja" ON "public"."filiais" FOR SELECT TO "authenticated" USING (((igreja_id = get_jwt_igreja_id()) OR has_role((select auth.uid()), 'super_admin'::app_role)));

-- ==================== fin_audit_log ====================
DROP POLICY IF EXISTS "fin_audit_log_select" ON "public"."fin_audit_log";
CREATE POLICY "fin_audit_log_select" ON "public"."fin_audit_log" FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== fin_extrato_ingestao_jobs ====================
DROP POLICY IF EXISTS "fin_ingestao_jobs_select" ON "public"."fin_extrato_ingestao_jobs";
CREATE POLICY "fin_ingestao_jobs_select" ON "public"."fin_extrato_ingestao_jobs" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = ANY (ARRAY['admin'::text, 'admin_igreja'::text, 'super_admin'::text])) AND ((ur.igreja_id = fin_extrato_ingestao_jobs.igreja_id) OR (ur.igreja_id IS NULL))))) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = ANY (ARRAY['tesoureiro'::text, 'admin_filial'::text])) AND (ur.igreja_id = fin_extrato_ingestao_jobs.igreja_id)))) AND ((filial_id IS NULL) OR (filial_id = get_current_user_filial_id()) OR (EXISTS ( SELECT 1
   FROM user_filial_access ufa
  WHERE ((ufa.user_id = (select auth.uid())) AND (ufa.filial_id = fin_extrato_ingestao_jobs.filial_id) AND (ufa.can_view = true))))))));

-- ==================== financeiro_config ====================
DROP POLICY IF EXISTS "financeiro_config_admin_all" ON "public"."financeiro_config";
CREATE POLICY "financeiro_config_admin_all" ON "public"."financeiro_config" USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = 'admin'::text) AND (ur.igreja_id = financeiro_config.igreja_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = 'admin'::text) AND (ur.igreja_id = financeiro_config.igreja_id)))));
DROP POLICY IF EXISTS "financeiro_config_select_same_church" ON "public"."financeiro_config";
CREATE POLICY "financeiro_config_select_same_church" ON "public"."financeiro_config" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.igreja_id = financeiro_config.igreja_id)))));

-- ==================== forma_pagamento_contas ====================
DROP POLICY IF EXISTS "Admin edita mapeamentos" ON "public"."forma_pagamento_contas";
CREATE POLICY "Admin edita mapeamentos" ON "public"."forma_pagamento_contas" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)));

-- ==================== formas_pagamento ====================
DROP POLICY IF EXISTS "Admins e tesoureiros gerenciam formas pagamento" ON "public"."formas_pagamento";
CREATE POLICY "Admins e tesoureiros gerenciam formas pagamento" ON "public"."formas_pagamento" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios autenticados podem ver formas pagamento ativas" ON "public"."formas_pagamento";
CREATE POLICY "Usuarios autenticados podem ver formas pagamento ativas" ON "public"."formas_pagamento" FOR SELECT USING ((((select auth.uid()) IS NOT NULL) AND (ativo = true) AND has_filial_access(igreja_id, filial_id)));

-- ==================== fornecedores ====================
DROP POLICY IF EXISTS "only_admins_can_delete_suppliers" ON "public"."fornecedores";
CREATE POLICY "only_admins_can_delete_suppliers" ON "public"."fornecedores" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "only_admins_treasurers_can_create_suppliers" ON "public"."fornecedores";
CREATE POLICY "only_admins_treasurers_can_create_suppliers" ON "public"."fornecedores" WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "only_admins_treasurers_can_update_suppliers" ON "public"."fornecedores";
CREATE POLICY "only_admins_treasurers_can_update_suppliers" ON "public"."fornecedores" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "only_admins_treasurers_can_view_suppliers" ON "public"."fornecedores";
CREATE POLICY "only_admins_treasurers_can_view_suppliers" ON "public"."fornecedores" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND ((select auth.uid()) IS NOT NULL) AND has_filial_access(igreja_id, filial_id)));

-- ==================== funcoes_igreja ====================
DROP POLICY IF EXISTS "Admins podem gerenciar funcoes" ON "public"."funcoes_igreja";
CREATE POLICY "Admins podem gerenciar funcoes" ON "public"."funcoes_igreja" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Todos podem ver funcoes ativas" ON "public"."funcoes_igreja";
CREATE POLICY "Todos podem ver funcoes ativas" ON "public"."funcoes_igreja" FOR SELECT USING ((((ativo = true) OR has_role((select auth.uid()), 'admin'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== getnet_ajustes ====================
DROP POLICY IF EXISTS "getnet_ajustes_modify" ON "public"."getnet_ajustes";
CREATE POLICY "getnet_ajustes_modify" ON "public"."getnet_ajustes" TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK ((igreja_id = get_current_user_igreja_id()));
DROP POLICY IF EXISTS "getnet_ajustes_select" ON "public"."getnet_ajustes";
CREATE POLICY "getnet_ajustes_select" ON "public"."getnet_ajustes" FOR SELECT TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== getnet_analitico ====================
DROP POLICY IF EXISTS "getnet_analitico_modify" ON "public"."getnet_analitico";
CREATE POLICY "getnet_analitico_modify" ON "public"."getnet_analitico" TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK ((igreja_id = get_current_user_igreja_id()));
DROP POLICY IF EXISTS "getnet_analitico_select" ON "public"."getnet_analitico";
CREATE POLICY "getnet_analitico_select" ON "public"."getnet_analitico" FOR SELECT TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== getnet_antecipacao_lotes ====================
DROP POLICY IF EXISTS "getnet_antecipacao_lotes_select" ON "public"."getnet_antecipacao_lotes";
CREATE POLICY "getnet_antecipacao_lotes_select" ON "public"."getnet_antecipacao_lotes" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = ANY (ARRAY['admin'::text, 'admin_igreja'::text, 'super_admin'::text])) AND ((ur.igreja_id = getnet_antecipacao_lotes.igreja_id) OR (ur.igreja_id IS NULL))))) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = ANY (ARRAY['tesoureiro'::text, 'admin_filial'::text])) AND (ur.igreja_id = getnet_antecipacao_lotes.igreja_id)))) AND ((filial_id IS NULL) OR (filial_id = get_current_user_filial_id()) OR (EXISTS ( SELECT 1
   FROM user_filial_access ufa
  WHERE ((ufa.user_id = (select auth.uid())) AND (ufa.filial_id = getnet_antecipacao_lotes.filial_id) AND (ufa.can_view = true))))))));

-- ==================== getnet_arquivos ====================
DROP POLICY IF EXISTS "getnet_arquivos_modify" ON "public"."getnet_arquivos";
CREATE POLICY "getnet_arquivos_modify" ON "public"."getnet_arquivos" TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK ((igreja_id = get_current_user_igreja_id()));
DROP POLICY IF EXISTS "getnet_arquivos_select" ON "public"."getnet_arquivos";
CREATE POLICY "getnet_arquivos_select" ON "public"."getnet_arquivos" FOR SELECT TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== getnet_financeiro_detalhe ====================
DROP POLICY IF EXISTS "getnet_fin_detalhe_modify" ON "public"."getnet_financeiro_detalhe";
CREATE POLICY "getnet_fin_detalhe_modify" ON "public"."getnet_financeiro_detalhe" TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK ((igreja_id = get_current_user_igreja_id()));
DROP POLICY IF EXISTS "getnet_fin_detalhe_select" ON "public"."getnet_financeiro_detalhe";
CREATE POLICY "getnet_fin_detalhe_select" ON "public"."getnet_financeiro_detalhe" FOR SELECT TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== getnet_financeiro_resumo ====================
DROP POLICY IF EXISTS "getnet_fin_resumo_modify" ON "public"."getnet_financeiro_resumo";
CREATE POLICY "getnet_fin_resumo_modify" ON "public"."getnet_financeiro_resumo" TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (EXISTS ( SELECT 1
   FROM integracoes_financeiras i
  WHERE ((i.id = getnet_financeiro_resumo.integracao_id) AND has_filial_access(i.igreja_id, i.filial_id)))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK (((igreja_id = get_current_user_igreja_id()) AND (EXISTS ( SELECT 1
   FROM integracoes_financeiras i
  WHERE ((i.id = getnet_financeiro_resumo.integracao_id) AND has_filial_access(i.igreja_id, i.filial_id))))));
DROP POLICY IF EXISTS "getnet_fin_resumo_select" ON "public"."getnet_financeiro_resumo";
CREATE POLICY "getnet_fin_resumo_select" ON "public"."getnet_financeiro_resumo" FOR SELECT TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND (EXISTS ( SELECT 1
   FROM integracoes_financeiras i
  WHERE ((i.id = getnet_financeiro_resumo.integracao_id) AND has_filial_access(i.igreja_id, i.filial_id)))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== getnet_recebivel_lancamentos ====================
DROP POLICY IF EXISTS "getnet_recebivel_lancamentos_select" ON "public"."getnet_recebivel_lancamentos";
CREATE POLICY "getnet_recebivel_lancamentos_select" ON "public"."getnet_recebivel_lancamentos" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = ANY (ARRAY['admin'::text, 'admin_igreja'::text, 'super_admin'::text])) AND ((ur.igreja_id = getnet_recebivel_lancamentos.igreja_id) OR (ur.igreja_id IS NULL))))) OR ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND ((ur.role)::text = ANY (ARRAY['tesoureiro'::text, 'admin_filial'::text])) AND (ur.igreja_id = getnet_recebivel_lancamentos.igreja_id)))) AND ((filial_id IS NULL) OR (filial_id = get_current_user_filial_id()) OR (EXISTS ( SELECT 1
   FROM user_filial_access ufa
  WHERE ((ufa.user_id = (select auth.uid())) AND (ufa.filial_id = getnet_recebivel_lancamentos.filial_id) AND (ufa.can_view = true))))))));

-- ==================== getnet_resumo ====================
DROP POLICY IF EXISTS "getnet_resumo_modify" ON "public"."getnet_resumo";
CREATE POLICY "getnet_resumo_modify" ON "public"."getnet_resumo" TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND has_filial_access(igreja_id, filial_id) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK (((igreja_id = get_current_user_igreja_id()) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "getnet_resumo_select" ON "public"."getnet_resumo";
CREATE POLICY "getnet_resumo_select" ON "public"."getnet_resumo" FOR SELECT TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND has_filial_access(igreja_id, filial_id) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== igrejas ====================
DROP POLICY IF EXISTS "Admins podem atualizar igreja" ON "public"."igrejas";
CREATE POLICY "Admins podem atualizar igreja" ON "public"."igrejas" FOR UPDATE USING ((has_role((select auth.uid()), 'admin'::app_role) AND (id = (NULLIF((select current_setting('request.jwt.claim.igreja_id'::text, true)), ''::text))::uuid))) WITH CHECK ((id = (NULLIF((select current_setting('request.jwt.claim.igreja_id'::text, true)), ''::text))::uuid));
DROP POLICY IF EXISTS "Admins podem gerenciar igrejas" ON "public"."igrejas";
CREATE POLICY "Admins podem gerenciar igrejas" ON "public"."igrejas" USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Igreja pode ser vista pelo tenant" ON "public"."igrejas";
CREATE POLICY "Igreja pode ser vista pelo tenant" ON "public"."igrejas" FOR SELECT USING ((id = (NULLIF((select current_setting('request.jwt.claim.igreja_id'::text, true)), ''::text))::uuid));
DROP POLICY IF EXISTS "Super admin pode gerenciar igrejas" ON "public"."igrejas";
CREATE POLICY "Super admin pode gerenciar igrejas" ON "public"."igrejas" USING (has_role((select auth.uid()), 'super_admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'super_admin'::app_role));
DROP POLICY IF EXISTS "Super admin pode ver todas igrejas" ON "public"."igrejas";
CREATE POLICY "Super admin pode ver todas igrejas" ON "public"."igrejas" FOR SELECT USING (has_role((select auth.uid()), 'super_admin'::app_role));
DROP POLICY IF EXISTS "Usuários autenticados veem sua igreja" ON "public"."igrejas";
CREATE POLICY "Usuários autenticados veem sua igreja" ON "public"."igrejas" FOR SELECT TO "authenticated" USING (((id = get_current_user_igreja_id()) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin'::app_role)));

-- ==================== import_job_items ====================
DROP POLICY IF EXISTS "Users can insert import job items" ON "public"."import_job_items";
CREATE POLICY "Users can insert import job items" ON "public"."import_job_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM import_jobs ij
  WHERE ((ij.id = import_job_items.job_id) AND (ij.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "Users can update import job items" ON "public"."import_job_items";
CREATE POLICY "Users can update import job items" ON "public"."import_job_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM import_jobs ij
  WHERE ((ij.id = import_job_items.job_id) AND (ij.user_id = (select auth.uid()))))));

-- ==================== import_jobs ====================
DROP POLICY IF EXISTS "Users can insert import jobs" ON "public"."import_jobs";
CREATE POLICY "Users can insert import jobs" ON "public"."import_jobs" FOR INSERT WITH CHECK ((has_filial_access(igreja_id, filial_id) AND (user_id = (select auth.uid()))));
DROP POLICY IF EXISTS "Users can update their own import jobs" ON "public"."import_jobs";
CREATE POLICY "Users can update their own import jobs" ON "public"."import_jobs" FOR UPDATE USING ((user_id = (select auth.uid())));

-- ==================== import_presets ====================
DROP POLICY IF EXISTS "Users can create presets" ON "public"."import_presets";
CREATE POLICY "Users can create presets" ON "public"."import_presets" FOR INSERT WITH CHECK (((user_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Users can delete their own presets" ON "public"."import_presets";
CREATE POLICY "Users can delete their own presets" ON "public"."import_presets" FOR DELETE USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can update their own presets" ON "public"."import_presets";
CREATE POLICY "Users can update their own presets" ON "public"."import_presets" FOR UPDATE USING ((user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can view presets" ON "public"."import_presets";
CREATE POLICY "Users can view presets" ON "public"."import_presets" FOR SELECT USING (((user_id = (select auth.uid())) OR has_filial_access(igreja_id, filial_id)));

-- ==================== inscricoes_eventos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar inscricoes_eventos" ON "public"."inscricoes_eventos";
CREATE POLICY "Admins podem gerenciar inscricoes_eventos" ON "public"."inscricoes_eventos" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem criar proprias inscricoes" ON "public"."inscricoes_eventos";
CREATE POLICY "Usuarios podem criar proprias inscricoes" ON "public"."inscricoes_eventos" WITH CHECK (((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem ver proprias inscricoes" ON "public"."inscricoes_eventos";
CREATE POLICY "Usuarios podem ver proprias inscricoes" ON "public"."inscricoes_eventos" USING (((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== inscricoes_jornada ====================
DROP POLICY IF EXISTS "Admins podem gerenciar inscrições" ON "public"."inscricoes_jornada";
CREATE POLICY "Admins podem gerenciar inscrições" ON "public"."inscricoes_jornada" USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins podem ver todas inscrições" ON "public"."inscricoes_jornada";
CREATE POLICY "Admins podem ver todas inscrições" ON "public"."inscricoes_jornada" FOR SELECT USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Membros podem se inscrever em jornadas" ON "public"."inscricoes_jornada";
CREATE POLICY "Membros podem se inscrever em jornadas" ON "public"."inscricoes_jornada" FOR INSERT TO "authenticated" WITH CHECK ((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Membros podem ver própria inscrição" ON "public"."inscricoes_jornada";
CREATE POLICY "Membros podem ver própria inscrição" ON "public"."inscricoes_jornada" FOR SELECT USING ((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Responsáveis podem ver suas inscrições" ON "public"."inscricoes_jornada";
CREATE POLICY "Responsáveis podem ver suas inscrições" ON "public"."inscricoes_jornada" FOR SELECT USING ((responsavel_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== integracao_voluntario ====================
DROP POLICY IF EXISTS "Admin e lider gerenciam integrações" ON "public"."integracao_voluntario";
CREATE POLICY "Admin e lider gerenciam integrações" ON "public"."integracao_voluntario" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)));
DROP POLICY IF EXISTS "Mentores e admin veem integrações" ON "public"."integracao_voluntario";
CREATE POLICY "Mentores e admin veem integrações" ON "public"."integracao_voluntario" FOR SELECT USING (((mentor_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)));

-- ==================== integracoes_execucoes_log ====================
DROP POLICY IF EXISTS "Visualizar logs de integracoes da igreja" ON "public"."integracoes_execucoes_log";
CREATE POLICY "Visualizar logs de integracoes da igreja" ON "public"."integracoes_execucoes_log" FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role_in_igreja((select auth.uid()), 'admin'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'admin_igreja'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'tesoureiro'::app_role, igreja_id)));

-- ==================== integracoes_financeiras ====================
DROP POLICY IF EXISTS "Atualizar integracoes financeiras" ON "public"."integracoes_financeiras";
CREATE POLICY "Atualizar integracoes financeiras" ON "public"."integracoes_financeiras" FOR UPDATE TO "authenticated" USING ((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role_in_igreja((select auth.uid()), 'admin'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'admin_igreja'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'tesoureiro'::app_role, igreja_id))) WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role_in_igreja((select auth.uid()), 'admin'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'admin_igreja'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'tesoureiro'::app_role, igreja_id)));
DROP POLICY IF EXISTS "Deletar integracoes financeiras" ON "public"."integracoes_financeiras";
CREATE POLICY "Deletar integracoes financeiras" ON "public"."integracoes_financeiras" FOR DELETE TO "authenticated" USING ((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role_in_igreja((select auth.uid()), 'admin'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'admin_igreja'::app_role, igreja_id)));
DROP POLICY IF EXISTS "Inserir integracoes financeiras" ON "public"."integracoes_financeiras";
CREATE POLICY "Inserir integracoes financeiras" ON "public"."integracoes_financeiras" FOR INSERT TO "authenticated" WITH CHECK ((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role_in_igreja((select auth.uid()), 'admin'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'admin_igreja'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'tesoureiro'::app_role, igreja_id)));
DROP POLICY IF EXISTS "Ver integracoes financeiras" ON "public"."integracoes_financeiras";
CREATE POLICY "Ver integracoes financeiras" ON "public"."integracoes_financeiras" FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'super_admin'::app_role) OR has_role_in_igreja((select auth.uid()), 'admin'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'admin_igreja'::app_role, igreja_id) OR has_role_in_igreja((select auth.uid()), 'tesoureiro'::app_role, igreja_id)));

-- ==================== intercessores ====================
DROP POLICY IF EXISTS "Admins e intercessores podem ver intercessores" ON "public"."intercessores";
CREATE POLICY "Admins e intercessores podem ver intercessores" ON "public"."intercessores" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR (user_id = (select auth.uid()))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem gerenciar intercessores" ON "public"."intercessores";
CREATE POLICY "Admins podem gerenciar intercessores" ON "public"."intercessores" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Intercessores podem ver seu próprio perfil" ON "public"."intercessores";
CREATE POLICY "Intercessores podem ver seu próprio perfil" ON "public"."intercessores" FOR SELECT USING (((select auth.uid()) = user_id));

-- ==================== itens_reembolso ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar itens" ON "public"."itens_reembolso";
CREATE POLICY "Admins e tesoureiros podem gerenciar itens" ON "public"."itens_reembolso" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins e tesoureiros podem ver todos itens" ON "public"."itens_reembolso";
CREATE POLICY "Admins e tesoureiros podem ver todos itens" ON "public"."itens_reembolso" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Edge functions podem inserir itens_reembolso" ON "public"."itens_reembolso";
CREATE POLICY "Edge functions podem inserir itens_reembolso" ON "public"."itens_reembolso" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM (solicitacoes_reembolso sr
     JOIN profiles p ON ((p.id = sr.solicitante_id)))
  WHERE ((sr.id = itens_reembolso.solicitacao_id) AND (p.user_id = (select auth.uid())) AND (sr.status = ANY (ARRAY['rascunho'::text, 'pendente'::text]))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)));
DROP POLICY IF EXISTS "Ver itens dos próprios reembolsos" ON "public"."itens_reembolso";
CREATE POLICY "Ver itens dos próprios reembolsos" ON "public"."itens_reembolso" FOR SELECT USING (((solicitacao_id IN ( SELECT solicitacoes_reembolso.id
   FROM solicitacoes_reembolso
  WHERE (solicitacoes_reembolso.solicitante_id IN ( SELECT profiles.id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid())))))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== itens_template_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar itens de templates" ON "public"."itens_template_culto";
CREATE POLICY "Admins podem gerenciar itens de templates" ON "public"."itens_template_culto" TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Membros podem ver itens de templates ativos" ON "public"."itens_template_culto";
CREATE POLICY "Membros podem ver itens de templates ativos" ON "public"."itens_template_culto" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM templates_culto
  WHERE ((templates_culto.id = itens_template_culto.template_id) AND ((templates_culto.ativo = true) OR has_role((select auth.uid()), 'admin'::app_role))))));

-- ==================== itens_template_liturgia ====================
DROP POLICY IF EXISTS "Admins podem gerenciar itens de templates" ON "public"."itens_template_liturgia";
CREATE POLICY "Admins podem gerenciar itens de templates" ON "public"."itens_template_liturgia" TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Membros podem ver itens de templates ativos" ON "public"."itens_template_liturgia";
CREATE POLICY "Membros podem ver itens de templates ativos" ON "public"."itens_template_liturgia" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM templates_liturgia
  WHERE ((templates_liturgia.id = itens_template_liturgia.template_id) AND ((templates_liturgia.ativo = true) OR has_role((select auth.uid()), 'admin'::app_role))))));

-- ==================== jornadas ====================
DROP POLICY IF EXISTS "Admins podem gerenciar jornadas" ON "public"."jornadas";
CREATE POLICY "Admins podem gerenciar jornadas" ON "public"."jornadas" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Todos podem ver jornadas ativas" ON "public"."jornadas";
CREATE POLICY "Todos podem ver jornadas ativas" ON "public"."jornadas" FOR SELECT USING ((((ativo = true) OR has_role((select auth.uid()), 'admin'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== kids_checkins ====================
DROP POLICY IF EXISTS "Pais podem fazer checkout dos filhos" ON "public"."kids_checkins";
CREATE POLICY "Pais podem fazer checkout dos filhos" ON "public"."kids_checkins" FOR UPDATE USING (((responsavel_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (checkout_at IS NULL))) WITH CHECK ((responsavel_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Responsaveis podem ver checkins dos filhos" ON "public"."kids_checkins";
CREATE POLICY "Responsaveis podem ver checkins dos filhos" ON "public"."kids_checkins" FOR SELECT USING (((responsavel_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Staff pode gerenciar checkins kids" ON "public"."kids_checkins";
CREATE POLICY "Staff pode gerenciar checkins kids" ON "public"."kids_checkins" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== kids_diario ====================
DROP POLICY IF EXISTS "Lideres gerenciam diarios" ON "public"."kids_diario";
CREATE POLICY "Lideres gerenciam diarios" ON "public"."kids_diario" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== liturgia_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar liturgia" ON "public"."liturgia_culto";
CREATE POLICY "Admins podem gerenciar liturgia" ON "public"."liturgia_culto" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== liturgia_recursos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar recursos liturgia" ON "public"."liturgia_recursos";
CREATE POLICY "Admins podem gerenciar recursos liturgia" ON "public"."liturgia_recursos" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== liturgia_templates ====================
DROP POLICY IF EXISTS "Admins podem gerenciar templates liturgia" ON "public"."liturgia_templates";
CREATE POLICY "Admins podem gerenciar templates liturgia" ON "public"."liturgia_templates" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== liturgias ====================
DROP POLICY IF EXISTS "Admins podem gerenciar liturgias" ON "public"."liturgias";
CREATE POLICY "Admins podem gerenciar liturgias" ON "public"."liturgias" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== logs_auditoria_chat ====================
DROP POLICY IF EXISTS "Admins e pastores podem visualizar logs" ON "public"."logs_auditoria_chat";
CREATE POLICY "Admins e pastores podem visualizar logs" ON "public"."logs_auditoria_chat" FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)));

-- ==================== logs_auditoria_replicacao ====================
DROP POLICY IF EXISTS "Admins podem inserir logs de replicacao" ON "public"."logs_auditoria_replicacao";
CREATE POLICY "Admins podem inserir logs de replicacao" ON "public"."logs_auditoria_replicacao" FOR INSERT WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins podem ver logs de replicacao" ON "public"."logs_auditoria_replicacao";
CREATE POLICY "Admins podem ver logs de replicacao" ON "public"."logs_auditoria_replicacao" FOR SELECT USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== logs_replicacao_cadastros ====================
DROP POLICY IF EXISTS "logs_replicacao_insert_admin" ON "public"."logs_replicacao_cadastros";
CREATE POLICY "logs_replicacao_insert_admin" ON "public"."logs_replicacao_cadastros" FOR INSERT WITH CHECK (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== membro_funcoes ====================
DROP POLICY IF EXISTS "Admins podem gerenciar funcoes membros" ON "public"."membro_funcoes";
CREATE POLICY "Admins podem gerenciar funcoes membros" ON "public"."membro_funcoes" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros podem ver suas próprias funções" ON "public"."membro_funcoes";
CREATE POLICY "Membros podem ver suas próprias funções" ON "public"."membro_funcoes" FOR SELECT TO "authenticated" USING ((membro_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== membros_time ====================
DROP POLICY IF EXISTS "Admin gerencia todos membros de times" ON "public"."membros_time";
CREATE POLICY "Admin gerencia todos membros de times" ON "public"."membros_time" TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Lider gerencia membros do seu time" ON "public"."membros_time";
CREATE POLICY "Lider gerencia membros do seu time" ON "public"."membros_time" TO "authenticated" USING ((is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id)));

-- ==================== midia_tags ====================
DROP POLICY IF EXISTS "Admins podem gerenciar midia_tags" ON "public"."midia_tags";
CREATE POLICY "Admins podem gerenciar midia_tags" ON "public"."midia_tags" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem gerenciar relação mídia-tags" ON "public"."midia_tags";
CREATE POLICY "Admins podem gerenciar relação mídia-tags" ON "public"."midia_tags" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== midias ====================
DROP POLICY IF EXISTS "Admins podem gerenciar midias" ON "public"."midias";
CREATE POLICY "Admins podem gerenciar midias" ON "public"."midias" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem gerenciar mídias" ON "public"."midias";
CREATE POLICY "Admins podem gerenciar mídias" ON "public"."midias" USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Todos podem ver midias ativas" ON "public"."midias";
CREATE POLICY "Todos podem ver midias ativas" ON "public"."midias" FOR SELECT USING ((((ativo = true) OR has_role((select auth.uid()), 'admin'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== midias_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar mídias" ON "public"."midias_culto";
CREATE POLICY "Admins podem gerenciar mídias" ON "public"."midias_culto" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== module_permissions ====================
DROP POLICY IF EXISTS "Admins podem gerenciar permissões" ON "public"."module_permissions";
CREATE POLICY "Admins podem gerenciar permissões" ON "public"."module_permissions" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== notificacao_eventos ====================
DROP POLICY IF EXISTS "Admins gerenciam eventos" ON "public"."notificacao_eventos";
CREATE POLICY "Admins gerenciam eventos" ON "public"."notificacao_eventos" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== notificacao_regras ====================
DROP POLICY IF EXISTS "Admin gerencia regras" ON "public"."notificacao_regras";
CREATE POLICY "Admin gerencia regras" ON "public"."notificacao_regras" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role)))));
DROP POLICY IF EXISTS "Admins gerenciam regras" ON "public"."notificacao_regras";
CREATE POLICY "Admins gerenciam regras" ON "public"."notificacao_regras" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== notifications ====================
DROP POLICY IF EXISTS "Usuarios podem atualizar proprias notificacoes" ON "public"."notifications";
CREATE POLICY "Usuarios podem atualizar proprias notificacoes" ON "public"."notifications" FOR UPDATE USING (((user_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem ver proprias notificacoes" ON "public"."notifications";
CREATE POLICY "Usuarios podem ver proprias notificacoes" ON "public"."notifications" FOR SELECT USING (((user_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuários marcam leitura de suas notificações" ON "public"."notifications";
CREATE POLICY "Usuários marcam leitura de suas notificações" ON "public"."notifications" FOR UPDATE USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Usuários podem atualizar suas notificações" ON "public"."notifications";
CREATE POLICY "Usuários podem atualizar suas notificações" ON "public"."notifications" FOR UPDATE USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Usuários podem ver suas notificações" ON "public"."notifications";
CREATE POLICY "Usuários podem ver suas notificações" ON "public"."notifications" FOR SELECT USING (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "Usuários veem suas próprias notificações" ON "public"."notifications";
CREATE POLICY "Usuários veem suas próprias notificações" ON "public"."notifications" FOR SELECT USING (((select auth.uid()) = user_id));

-- ==================== onboarding_requests ====================
DROP POLICY IF EXISTS "Super admin gerencia onboarding" ON "public"."onboarding_requests";
CREATE POLICY "Super admin gerencia onboarding" ON "public"."onboarding_requests" USING (has_role((select auth.uid()), 'super_admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'super_admin'::app_role));
DROP POLICY IF EXISTS "Usuario pode ver sua solicitacao" ON "public"."onboarding_requests";
CREATE POLICY "Usuario pode ver sua solicitacao" ON "public"."onboarding_requests" FOR SELECT USING ((email = ( SELECT users.email
   FROM auth.users
  WHERE (users.id = (select auth.uid())))));

-- ==================== pedidos_oracao ====================
DROP POLICY IF EXISTS "admin_delete_pedidos" ON "public"."pedidos_oracao";
CREATE POLICY "admin_delete_pedidos" ON "public"."pedidos_oracao" FOR DELETE TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "admin_pastor_select_todos" ON "public"."pedidos_oracao";
CREATE POLICY "admin_pastor_select_todos" ON "public"."pedidos_oracao" FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "admin_pastor_update_todos" ON "public"."pedidos_oracao";
CREATE POLICY "admin_pastor_update_todos" ON "public"."pedidos_oracao" FOR UPDATE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "intercessor_select_designados_nao_confidenciais" ON "public"."pedidos_oracao";
CREATE POLICY "intercessor_select_designados_nao_confidenciais" ON "public"."pedidos_oracao" FOR SELECT TO "authenticated" USING (((confidencial = false) AND (intercessor_id IN ( SELECT intercessores.id
   FROM intercessores
  WHERE ((intercessores.user_id = (select auth.uid())) AND (intercessores.ativo = true)))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "intercessor_update_designados" ON "public"."pedidos_oracao";
CREATE POLICY "intercessor_update_designados" ON "public"."pedidos_oracao" FOR UPDATE TO "authenticated" USING (((intercessor_id IN ( SELECT intercessores.id
   FROM intercessores
  WHERE ((intercessores.user_id = (select auth.uid())) AND (intercessores.ativo = true)))) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((intercessor_id IN ( SELECT intercessores.id
   FROM intercessores
  WHERE ((intercessores.user_id = (select auth.uid())) AND (intercessores.ativo = true)))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== pessoas_duplicatas_suspeitas ====================
DROP POLICY IF EXISTS "Admin pode atualizar suspeitas de duplicidade" ON "public"."pessoas_duplicatas_suspeitas";
CREATE POLICY "Admin pode atualizar suspeitas de duplicidade" ON "public"."pessoas_duplicatas_suspeitas" FOR UPDATE TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin pode deletar suspeitas de duplicidade" ON "public"."pessoas_duplicatas_suspeitas";
CREATE POLICY "Admin pode deletar suspeitas de duplicidade" ON "public"."pessoas_duplicatas_suspeitas" FOR DELETE TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin pode inserir suspeitas de duplicidade" ON "public"."pessoas_duplicatas_suspeitas";
CREATE POLICY "Admin pode inserir suspeitas de duplicidade" ON "public"."pessoas_duplicatas_suspeitas" FOR INSERT TO "authenticated" WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin pode visualizar suspeitas de duplicidade" ON "public"."pessoas_duplicatas_suspeitas";
CREATE POLICY "Admin pode visualizar suspeitas de duplicidade" ON "public"."pessoas_duplicatas_suspeitas" FOR SELECT TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== pessoas_mesclagens_historico ====================
DROP POLICY IF EXISTS "Admin pode inserir histórico de mesclagens" ON "public"."pessoas_mesclagens_historico";
CREATE POLICY "Admin pode inserir histórico de mesclagens" ON "public"."pessoas_mesclagens_historico" FOR INSERT TO "authenticated" WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin pode visualizar histórico de mesclagens" ON "public"."pessoas_mesclagens_historico";
CREATE POLICY "Admin pode visualizar histórico de mesclagens" ON "public"."pessoas_mesclagens_historico" FOR SELECT TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== pix_recebimentos ====================
DROP POLICY IF EXISTS "Users can insert pix recebimentos for their church" ON "public"."pix_recebimentos";
CREATE POLICY "Users can insert pix recebimentos for their church" ON "public"."pix_recebimentos" FOR INSERT WITH CHECK ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Users can update pix recebimentos from their church" ON "public"."pix_recebimentos";
CREATE POLICY "Users can update pix recebimentos from their church" ON "public"."pix_recebimentos" FOR UPDATE USING ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))))) WITH CHECK ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Users can view pix recebimentos from their church" ON "public"."pix_recebimentos";
CREATE POLICY "Users can view pix recebimentos from their church" ON "public"."pix_recebimentos" FOR SELECT USING ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== pix_webhook_temp ====================
DROP POLICY IF EXISTS "pix_webhook_temp_delete_finance" ON "public"."pix_webhook_temp";
CREATE POLICY "pix_webhook_temp_delete_finance" ON "public"."pix_webhook_temp" FOR DELETE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "pix_webhook_temp_insert_finance" ON "public"."pix_webhook_temp";
CREATE POLICY "pix_webhook_temp_insert_finance" ON "public"."pix_webhook_temp" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "pix_webhook_temp_select_finance" ON "public"."pix_webhook_temp";
CREATE POLICY "pix_webhook_temp_select_finance" ON "public"."pix_webhook_temp" FOR SELECT TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "pix_webhook_temp_update_finance" ON "public"."pix_webhook_temp";
CREATE POLICY "pix_webhook_temp_update_finance" ON "public"."pix_webhook_temp" FOR UPDATE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));

-- ==================== posicoes_time ====================
DROP POLICY IF EXISTS "Admins podem gerenciar posições" ON "public"."posicoes_time";
CREATE POLICY "Admins podem gerenciar posições" ON "public"."posicoes_time" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Lider gerencia posições do seu time" ON "public"."posicoes_time";
CREATE POLICY "Lider gerencia posições do seu time" ON "public"."posicoes_time" TO "authenticated" USING ((is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((is_time_leader((select auth.uid()), time_id) AND has_filial_access(igreja_id, filial_id)));

-- ==================== presencas_aula ====================
DROP POLICY IF EXISTS "Admins podem gerenciar presencas" ON "public"."presencas_aula";
CREATE POLICY "Admins podem gerenciar presencas" ON "public"."presencas_aula" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Alunos podem ver proprias presencas" ON "public"."presencas_aula";
CREATE POLICY "Alunos podem ver proprias presencas" ON "public"."presencas_aula" FOR SELECT USING (((aluno_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== presencas_culto ====================
DROP POLICY IF EXISTS "Lideres gerenciam presenca" ON "public"."presencas_culto";
CREATE POLICY "Lideres gerenciam presenca" ON "public"."presencas_culto" TO "authenticated" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role)));

-- ==================== profile_audit_log ====================
DROP POLICY IF EXISTS "Users can view audit logs from same church" ON "public"."profile_audit_log";
CREATE POLICY "Users can view audit logs from same church" ON "public"."profile_audit_log" FOR SELECT TO "authenticated" USING ((igreja_id = ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))));

-- ==================== profile_contatos ====================
DROP POLICY IF EXISTS "Admins can manage all contacts" ON "public"."profile_contatos";
CREATE POLICY "Admins can manage all contacts" ON "public"."profile_contatos" USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role)))));
DROP POLICY IF EXISTS "Church staff can view contacts in same filial" ON "public"."profile_contatos";
CREATE POLICY "Church staff can view contacts in same filial" ON "public"."profile_contatos" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'professor'::app_role)) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = profile_contatos.profile_id) AND has_filial_access(profiles.igreja_id, profiles.filial_id))))));
DROP POLICY IF EXISTS "Users can delete their own contacts" ON "public"."profile_contatos";
CREATE POLICY "Users can delete their own contacts" ON "public"."profile_contatos" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = profile_contatos.profile_id) AND (profiles.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "Users can manage their own contacts" ON "public"."profile_contatos";
CREATE POLICY "Users can manage their own contacts" ON "public"."profile_contatos" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = profile_contatos.profile_id) AND (profiles.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "Users can update their own contacts" ON "public"."profile_contatos";
CREATE POLICY "Users can update their own contacts" ON "public"."profile_contatos" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = profile_contatos.profile_id) AND (profiles.user_id = (select auth.uid()))))));
DROP POLICY IF EXISTS "Users can view their own contacts" ON "public"."profile_contatos";
CREATE POLICY "Users can view their own contacts" ON "public"."profile_contatos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = profile_contatos.profile_id) AND (profiles.user_id = (select auth.uid()))))));

-- ==================== profiles ====================
DROP POLICY IF EXISTS "Tecnico ver perfis da mesma igreja" ON "public"."profiles";
CREATE POLICY "Tecnico ver perfis da mesma igreja" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((has_role((select auth.uid()), 'tecnico'::app_role) AND (igreja_id = get_current_user_igreja_id())));
DROP POLICY IF EXISTS "admins_can_create_profiles" ON "public"."profiles";
CREATE POLICY "admins_can_create_profiles" ON "public"."profiles" WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "admins_can_update_any_profile" ON "public"."profiles";
CREATE POLICY "admins_can_update_any_profile" ON "public"."profiles" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON "public"."profiles";
CREATE POLICY "admins_can_view_all_profiles" ON "public"."profiles" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "members_can_create_dependents" ON "public"."profiles";
CREATE POLICY "members_can_create_dependents" ON "public"."profiles" FOR INSERT WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (user_id IS NULL) AND (familia_id IS NOT NULL) AND (familia_id = get_user_familia_id((select auth.uid())))));
DROP POLICY IF EXISTS "members_can_create_family_profiles" ON "public"."profiles";
CREATE POLICY "members_can_create_family_profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (((user_id IS NULL) OR (user_id = (select auth.uid()))));
DROP POLICY IF EXISTS "members_can_update_dependents" ON "public"."profiles";
CREATE POLICY "members_can_update_dependents" ON "public"."profiles" FOR UPDATE USING ((((select auth.uid()) IS NOT NULL) AND (user_id IS NULL) AND (familia_id IS NOT NULL) AND (familia_id = get_user_familia_id((select auth.uid())))));
DROP POLICY IF EXISTS "members_can_view_family_members" ON "public"."profiles";
CREATE POLICY "members_can_view_family_members" ON "public"."profiles" FOR SELECT USING ((((select auth.uid()) IS NOT NULL) AND ((user_id = (select auth.uid())) OR ((familia_id IS NOT NULL) AND (familia_id = get_user_familia_id((select auth.uid())))))));
DROP POLICY IF EXISTS "users_can_create_own_profile" ON "public"."profiles";
CREATE POLICY "users_can_create_own_profile" ON "public"."profiles" FOR INSERT WITH CHECK ((((select auth.uid()) = user_id) AND ((select auth.uid()) IS NOT NULL) AND (user_id IS NOT NULL)));
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON "public"."profiles";
CREATE POLICY "users_can_insert_own_profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (((select auth.uid()) = user_id));
DROP POLICY IF EXISTS "users_can_update_own_profile" ON "public"."profiles";
CREATE POLICY "users_can_update_own_profile" ON "public"."profiles" USING ((((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "users_can_view_own_profile" ON "public"."profiles";
CREATE POLICY "users_can_view_own_profile" ON "public"."profiles" USING ((((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id)));

-- ==================== projetos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar projetos" ON "public"."projetos";
CREATE POLICY "Admins podem gerenciar projetos" ON "public"."projetos" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros veem projetos onde sao responsaveis" ON "public"."projetos";
CREATE POLICY "Membros veem projetos onde sao responsaveis" ON "public"."projetos" FOR SELECT USING ((lider_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== reclass_job_items ====================
DROP POLICY IF EXISTS "Users can insert reclass job items" ON "public"."reclass_job_items";
CREATE POLICY "Users can insert reclass job items" ON "public"."reclass_job_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM reclass_jobs rj
  WHERE ((rj.id = reclass_job_items.job_id) AND (rj.user_id = (select auth.uid()))))));

-- ==================== reclass_jobs ====================
DROP POLICY IF EXISTS "Users can insert reclass jobs" ON "public"."reclass_jobs";
CREATE POLICY "Users can insert reclass jobs" ON "public"."reclass_jobs" FOR INSERT WITH CHECK (((user_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Users can update their own reclass jobs" ON "public"."reclass_jobs";
CREATE POLICY "Users can update their own reclass jobs" ON "public"."reclass_jobs" FOR UPDATE USING ((user_id = (select auth.uid())));

-- ==================== reconciliacao_audit_logs ====================
DROP POLICY IF EXISTS "Users can insert audit logs for their church" ON "public"."reconciliacao_audit_logs";
CREATE POLICY "Users can insert audit logs for their church" ON "public"."reconciliacao_audit_logs" FOR INSERT WITH CHECK ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Users can view audit logs from their church" ON "public"."reconciliacao_audit_logs";
CREATE POLICY "Users can view audit logs from their church" ON "public"."reconciliacao_audit_logs" FOR SELECT USING ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== respostas_quiz ====================
DROP POLICY IF EXISTS "Admin gerencia respostas" ON "public"."respostas_quiz";
CREATE POLICY "Admin gerencia respostas" ON "public"."respostas_quiz" USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Aluno insere respostas" ON "public"."respostas_quiz";
CREATE POLICY "Aluno insere respostas" ON "public"."respostas_quiz" FOR INSERT WITH CHECK (((select auth.uid()) IN ( SELECT p.user_id
   FROM (inscricoes_jornada ij
     JOIN profiles p ON ((ij.pessoa_id = p.id)))
  WHERE (ij.id = respostas_quiz.inscricao_id))));
DROP POLICY IF EXISTS "Aluno vê suas respostas" ON "public"."respostas_quiz";
CREATE POLICY "Aluno vê suas respostas" ON "public"."respostas_quiz" FOR SELECT USING (((select auth.uid()) IN ( SELECT p.user_id
   FROM (inscricoes_jornada ij
     JOIN profiles p ON ((ij.pessoa_id = p.id)))
  WHERE (ij.id = respostas_quiz.inscricao_id))));

-- ==================== resultados_teste ====================
DROP POLICY IF EXISTS "Admin e lider gerenciam resultados" ON "public"."resultados_teste";
CREATE POLICY "Admin e lider gerenciam resultados" ON "public"."resultados_teste" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)));
DROP POLICY IF EXISTS "Candidatos e mentores veem resultados" ON "public"."resultados_teste";
CREATE POLICY "Candidatos e mentores veem resultados" ON "public"."resultados_teste" FOR SELECT USING (((candidato_id IN ( SELECT candidatos_voluntario.id
   FROM candidatos_voluntario
  WHERE (candidatos_voluntario.pessoa_id = ( SELECT profiles.id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM integracao_voluntario
  WHERE ((integracao_voluntario.id = resultados_teste.integracao_id) AND (integracao_voluntario.mentor_id = ( SELECT profiles.id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid()))))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)));

-- ==================== role_permissions ====================
DROP POLICY IF EXISTS "Admins podem gerenciar role_permissions" ON "public"."role_permissions";
CREATE POLICY "Admins podem gerenciar role_permissions" ON "public"."role_permissions" USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== role_permissions_audit ====================
DROP POLICY IF EXISTS "Admins podem ver auditoria de permissões" ON "public"."role_permissions_audit";
CREATE POLICY "Admins podem ver auditoria de permissões" ON "public"."role_permissions_audit" FOR SELECT USING (has_role((select auth.uid()), 'admin'::app_role));

-- ==================== salas ====================
DROP POLICY IF EXISTS "Admins podem gerenciar salas" ON "public"."salas";
CREATE POLICY "Admins podem gerenciar salas" ON "public"."salas" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Todos podem ver salas ativas" ON "public"."salas";
CREATE POLICY "Todos podem ver salas ativas" ON "public"."salas" FOR SELECT USING ((((ativo = true) OR has_role((select auth.uid()), 'admin'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== sentimentos_membros ====================
DROP POLICY IF EXISTS "Admins e pastores podem ver sentimentos" ON "public"."sentimentos_membros";
CREATE POLICY "Admins e pastores podem ver sentimentos" ON "public"."sentimentos_membros" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros podem ver seus próprios sentimentos" ON "public"."sentimentos_membros";
CREATE POLICY "Membros podem ver seus próprios sentimentos" ON "public"."sentimentos_membros" FOR SELECT USING ((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Usuarios podem registrar proprios sentimentos" ON "public"."sentimentos_membros";
CREATE POLICY "Usuarios podem registrar proprios sentimentos" ON "public"."sentimentos_membros" FOR INSERT WITH CHECK (((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem ver proprios sentimentos" ON "public"."sentimentos_membros";
CREATE POLICY "Usuarios podem ver proprios sentimentos" ON "public"."sentimentos_membros" FOR SELECT USING (((pessoa_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== sessoes_contagem ====================
DROP POLICY IF EXISTS "sessoes_contagem_insert_admin" ON "public"."sessoes_contagem";
CREATE POLICY "sessoes_contagem_insert_admin" ON "public"."sessoes_contagem" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'admin'::app_role) AND (ur.igreja_id = sessoes_contagem.igreja_id)))));
DROP POLICY IF EXISTS "sessoes_contagem_select_same_church" ON "public"."sessoes_contagem";
CREATE POLICY "sessoes_contagem_select_same_church" ON "public"."sessoes_contagem" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.igreja_id = sessoes_contagem.igreja_id)))));
DROP POLICY IF EXISTS "sessoes_contagem_update_admin" ON "public"."sessoes_contagem";
CREATE POLICY "sessoes_contagem_update_admin" ON "public"."sessoes_contagem" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'admin'::app_role) AND (ur.igreja_id = sessoes_contagem.igreja_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = (select auth.uid())) AND (ur.role = 'admin'::app_role) AND (ur.igreja_id = sessoes_contagem.igreja_id)))));

-- ==================== sessoes_itens_draft ====================
DROP POLICY IF EXISTS "itens_draft_manage_finance_roles" ON "public"."sessoes_itens_draft";
CREATE POLICY "itens_draft_manage_finance_roles" ON "public"."sessoes_itens_draft" USING (((EXISTS ( SELECT 1
   FROM sessoes_contagem s
  WHERE ((s.id = sessoes_itens_draft.sessao_id) AND has_filial_access(s.igreja_id, s.filial_id)))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)))) WITH CHECK (((EXISTS ( SELECT 1
   FROM sessoes_contagem s
  WHERE ((s.id = sessoes_itens_draft.sessao_id) AND has_filial_access(s.igreja_id, s.filial_id)))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role))));

-- ==================== short_links ====================
DROP POLICY IF EXISTS "short_links_delete_owner_admin" ON "public"."short_links";
CREATE POLICY "short_links_delete_owner_admin" ON "public"."short_links" FOR DELETE TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND ((created_by = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))));
DROP POLICY IF EXISTS "short_links_insert_authenticated" ON "public"."short_links";
CREATE POLICY "short_links_insert_authenticated" ON "public"."short_links" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id = get_current_user_igreja_id()) AND (created_by = (select auth.uid()))));
DROP POLICY IF EXISTS "short_links_update_owner_admin" ON "public"."short_links";
CREATE POLICY "short_links_update_owner_admin" ON "public"."short_links" FOR UPDATE TO "authenticated" USING (((igreja_id = get_current_user_igreja_id()) AND ((created_by = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)))) WITH CHECK ((igreja_id = get_current_user_igreja_id()));

-- ==================== solicitacoes_reembolso ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar reembolsos" ON "public"."solicitacoes_reembolso";
CREATE POLICY "Admins e tesoureiros podem gerenciar reembolsos" ON "public"."solicitacoes_reembolso" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem criar proprios reembolsos" ON "public"."solicitacoes_reembolso";
CREATE POLICY "Usuarios podem criar proprios reembolsos" ON "public"."solicitacoes_reembolso" FOR INSERT WITH CHECK (((solicitante_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem ver proprios reembolsos" ON "public"."solicitacoes_reembolso";
CREATE POLICY "Usuarios podem ver proprios reembolsos" ON "public"."solicitacoes_reembolso" FOR SELECT USING (((solicitante_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuários podem deletar rascunhos" ON "public"."solicitacoes_reembolso";
CREATE POLICY "Usuários podem deletar rascunhos" ON "public"."solicitacoes_reembolso" FOR DELETE TO "authenticated" USING (((solicitante_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))
 LIMIT 1)) AND (status = 'rascunho'::text)));
DROP POLICY IF EXISTS "Usuários podem editar suas solicitações" ON "public"."solicitacoes_reembolso";
CREATE POLICY "Usuários podem editar suas solicitações" ON "public"."solicitacoes_reembolso" FOR UPDATE USING ((solicitante_id = ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid()))
 LIMIT 1)));

-- ==================== subcategorias_financeiras ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar subcategorias" ON "public"."subcategorias_financeiras";
CREATE POLICY "Admins e tesoureiros podem gerenciar subcategorias" ON "public"."subcategorias_financeiras" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios autenticados podem ver subcategorias ativas" ON "public"."subcategorias_financeiras";
CREATE POLICY "Usuarios autenticados podem ver subcategorias ativas" ON "public"."subcategorias_financeiras" FOR SELECT USING ((((select auth.uid()) IS NOT NULL) AND (ativo = true)));

-- ==================== tags_midias ====================
DROP POLICY IF EXISTS "Admins podem gerenciar tags" ON "public"."tags_midias";
CREATE POLICY "Admins podem gerenciar tags" ON "public"."tags_midias" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== tarefas ====================
DROP POLICY IF EXISTS "Admins podem gerenciar tarefas" ON "public"."tarefas";
CREATE POLICY "Admins podem gerenciar tarefas" ON "public"."tarefas" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Responsaveis gerenciam suas tarefas" ON "public"."tarefas";
CREATE POLICY "Responsaveis gerenciam suas tarefas" ON "public"."tarefas" USING ((responsavel_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Responsaveis podem atualizar tarefas" ON "public"."tarefas";
CREATE POLICY "Responsaveis podem atualizar tarefas" ON "public"."tarefas" FOR UPDATE USING (((responsavel_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Responsaveis podem ver tarefas" ON "public"."tarefas";
CREATE POLICY "Responsaveis podem ver tarefas" ON "public"."tarefas" FOR SELECT USING (((responsavel_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Secretarios visualizam tarefas" ON "public"."tarefas";
CREATE POLICY "Secretarios visualizam tarefas" ON "public"."tarefas" FOR SELECT USING ((has_role((select auth.uid()), 'secretario'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== templates_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar templates" ON "public"."templates_culto";
CREATE POLICY "Admins podem gerenciar templates" ON "public"."templates_culto" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros podem ver templates ativos" ON "public"."templates_culto";
CREATE POLICY "Membros podem ver templates ativos" ON "public"."templates_culto" FOR SELECT USING ((((ativo = true) OR has_role((select auth.uid()), 'admin'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== templates_liturgia ====================
DROP POLICY IF EXISTS "Admins podem gerenciar templates" ON "public"."templates_liturgia";
CREATE POLICY "Admins podem gerenciar templates" ON "public"."templates_liturgia" TO "authenticated" USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Membros podem ver templates ativos" ON "public"."templates_liturgia";
CREATE POLICY "Membros podem ver templates ativos" ON "public"."templates_liturgia" FOR SELECT TO "authenticated" USING (((ativo = true) OR has_role((select auth.uid()), 'admin'::app_role)));

-- ==================== tenant_metricas ====================
DROP POLICY IF EXISTS "Super admin pode gerenciar metricas" ON "public"."tenant_metricas";
CREATE POLICY "Super admin pode gerenciar metricas" ON "public"."tenant_metricas" USING (has_role((select auth.uid()), 'super_admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'super_admin'::app_role));
DROP POLICY IF EXISTS "Super admin pode ver todas metricas" ON "public"."tenant_metricas";
CREATE POLICY "Super admin pode ver todas metricas" ON "public"."tenant_metricas" FOR SELECT USING (has_role((select auth.uid()), 'super_admin'::app_role));

-- ==================== testemunhos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar testemunhos" ON "public"."testemunhos";
CREATE POLICY "Admins podem gerenciar testemunhos" ON "public"."testemunhos" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Autores podem atualizar seus próprios testemunhos" ON "public"."testemunhos";
CREATE POLICY "Autores podem atualizar seus próprios testemunhos" ON "public"."testemunhos" FOR UPDATE USING ((autor_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Autores podem ver seus próprios testemunhos" ON "public"."testemunhos";
CREATE POLICY "Autores podem ver seus próprios testemunhos" ON "public"."testemunhos" FOR SELECT USING ((autor_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Todos podem ver testemunhos publicos" ON "public"."testemunhos";
CREATE POLICY "Todos podem ver testemunhos publicos" ON "public"."testemunhos" FOR SELECT USING ((((status = 'publico'::status_testemunho) OR has_role((select auth.uid()), 'admin'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Usuarios podem criar testemunhos" ON "public"."testemunhos";
CREATE POLICY "Usuarios podem criar testemunhos" ON "public"."testemunhos" FOR INSERT WITH CHECK (((autor_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND has_filial_access(igreja_id, filial_id)));

-- ==================== testes_ministerio ====================
DROP POLICY IF EXISTS "Admin gerencia testes" ON "public"."testes_ministerio";
CREATE POLICY "Admin gerencia testes" ON "public"."testes_ministerio" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role)));

-- ==================== times ====================
DROP POLICY IF EXISTS "Admins podem gerenciar times" ON "public"."times";
CREATE POLICY "Admins podem gerenciar times" ON "public"."times" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Lider atualiza seu time" ON "public"."times";
CREATE POLICY "Lider atualiza seu time" ON "public"."times" FOR UPDATE TO "authenticated" USING ((is_time_leader((select auth.uid()), id) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((is_time_leader((select auth.uid()), id) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros podem ver times ativos" ON "public"."times";
CREATE POLICY "Membros podem ver times ativos" ON "public"."times" FOR SELECT TO "authenticated" USING ((((ativo = true) OR has_role((select auth.uid()), 'admin'::app_role)) AND has_filial_access(igreja_id, filial_id)));

-- ==================== times_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar times" ON "public"."times_culto";
CREATE POLICY "Admins podem gerenciar times" ON "public"."times_culto" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));

-- ==================== transacoes_financeiras ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar transações" ON "public"."transacoes_financeiras";
CREATE POLICY "Admins e tesoureiros podem gerenciar transações" ON "public"."transacoes_financeiras" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros criam itens de reembolso" ON "public"."transacoes_financeiras";
CREATE POLICY "Membros criam itens de reembolso" ON "public"."transacoes_financeiras" FOR INSERT TO "authenticated" WITH CHECK (((solicitacao_reembolso_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (solicitacoes_reembolso sr
     JOIN profiles p ON ((p.id = sr.solicitante_id)))
  WHERE ((sr.id = transacoes_financeiras.solicitacao_reembolso_id) AND (p.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "Membros editam itens de reembolso rascunho" ON "public"."transacoes_financeiras";
CREATE POLICY "Membros editam itens de reembolso rascunho" ON "public"."transacoes_financeiras" FOR UPDATE TO "authenticated" USING (((solicitacao_reembolso_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (solicitacoes_reembolso sr
     JOIN profiles p ON ((p.id = sr.solicitante_id)))
  WHERE ((sr.id = transacoes_financeiras.solicitacao_reembolso_id) AND (p.user_id = (select auth.uid())) AND (sr.status = 'rascunho'::text))))));
DROP POLICY IF EXISTS "Membros excluem itens de reembolso rascunho" ON "public"."transacoes_financeiras";
CREATE POLICY "Membros excluem itens de reembolso rascunho" ON "public"."transacoes_financeiras" FOR DELETE TO "authenticated" USING (((solicitacao_reembolso_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (solicitacoes_reembolso sr
     JOIN profiles p ON ((p.id = sr.solicitante_id)))
  WHERE ((sr.id = transacoes_financeiras.solicitacao_reembolso_id) AND (p.user_id = (select auth.uid())) AND (sr.status = 'rascunho'::text))))));
DROP POLICY IF EXISTS "Membros veem seus itens de reembolso" ON "public"."transacoes_financeiras";
CREATE POLICY "Membros veem seus itens de reembolso" ON "public"."transacoes_financeiras" FOR SELECT TO "authenticated" USING (((solicitacao_reembolso_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (solicitacoes_reembolso sr
     JOIN profiles p ON ((p.id = sr.solicitante_id)))
  WHERE ((sr.id = transacoes_financeiras.solicitacao_reembolso_id) AND (p.user_id = (select auth.uid())))))));

-- ==================== transferencias_contas ====================
DROP POLICY IF EXISTS "Finance team delete transferencias" ON "public"."transferencias_contas";
CREATE POLICY "Finance team delete transferencias" ON "public"."transferencias_contas" FOR DELETE TO "authenticated" USING (((igreja_id = get_jwt_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team insert transferencias" ON "public"."transferencias_contas";
CREATE POLICY "Finance team insert transferencias" ON "public"."transferencias_contas" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id = get_jwt_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Finance team update transferencias" ON "public"."transferencias_contas";
CREATE POLICY "Finance team update transferencias" ON "public"."transferencias_contas" FOR UPDATE TO "authenticated" USING (((igreja_id = get_jwt_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK ((igreja_id = get_jwt_igreja_id()));

-- ==================== user_app_roles ====================
DROP POLICY IF EXISTS "Admins podem gerenciar user_app_roles" ON "public"."user_app_roles";
CREATE POLICY "Admins podem gerenciar user_app_roles" ON "public"."user_app_roles" USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins podem ver todos os roles" ON "public"."user_app_roles";
CREATE POLICY "Admins podem ver todos os roles" ON "public"."user_app_roles" FOR SELECT USING (has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Usuários podem ver seus próprios roles" ON "public"."user_app_roles";
CREATE POLICY "Usuários podem ver seus próprios roles" ON "public"."user_app_roles" FOR SELECT USING (((select auth.uid()) = user_id));

-- ==================== user_filial_access ====================
DROP POLICY IF EXISTS "user_filial_access_manage" ON "public"."user_filial_access";
CREATE POLICY "user_filial_access_manage" ON "public"."user_filial_access" USING (((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "user_filial_access_select" ON "public"."user_filial_access";
CREATE POLICY "user_filial_access_select" ON "public"."user_filial_access" FOR SELECT TO "authenticated" USING (((user_id = (select auth.uid())) OR ((igreja_id = get_current_user_igreja_id()) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'admin_filial'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))));

-- ==================== user_roles ====================
DROP POLICY IF EXISTS "user_roles_delete_admin" ON "public"."user_roles";
CREATE POLICY "user_roles_delete_admin" ON "public"."user_roles" FOR DELETE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND ((igreja_id IS NULL) OR (igreja_id = get_current_user_igreja_id()))) OR (has_role((select auth.uid()), 'admin_igreja'::app_role) AND (igreja_id = get_current_user_igreja_id()) AND (role <> ALL (ARRAY['super_admin'::app_role, 'admin'::app_role]))) OR has_role((select auth.uid()), 'super_admin'::app_role)));
DROP POLICY IF EXISTS "user_roles_insert_admin" ON "public"."user_roles";
CREATE POLICY "user_roles_insert_admin" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) AND ((igreja_id IS NULL) OR (igreja_id = get_current_user_igreja_id()))) OR (has_role((select auth.uid()), 'admin_igreja'::app_role) AND (igreja_id = get_current_user_igreja_id()) AND (role <> ALL (ARRAY['super_admin'::app_role, 'admin'::app_role]))) OR has_role((select auth.uid()), 'super_admin'::app_role)));
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON "public"."user_roles";
CREATE POLICY "user_roles_select_own_or_admin" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (((user_id = (select auth.uid())) OR (has_role((select auth.uid()), 'admin'::app_role) AND ((igreja_id IS NULL) OR (igreja_id = get_current_user_igreja_id()))) OR (has_role((select auth.uid()), 'admin_igreja'::app_role) AND (igreja_id = get_current_user_igreja_id())) OR has_role((select auth.uid()), 'super_admin'::app_role)));
DROP POLICY IF EXISTS "user_roles_update_admin" ON "public"."user_roles";
CREATE POLICY "user_roles_update_admin" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) AND ((igreja_id IS NULL) OR (igreja_id = get_current_user_igreja_id()))) OR (has_role((select auth.uid()), 'admin_igreja'::app_role) AND (igreja_id = get_current_user_igreja_id()) AND (role <> ALL (ARRAY['super_admin'::app_role, 'admin'::app_role]))) OR has_role((select auth.uid()), 'super_admin'::app_role)));

-- ==================== visitante_contatos ====================
DROP POLICY IF EXISTS "Admins podem atualizar contatos" ON "public"."visitante_contatos";
CREATE POLICY "Admins podem atualizar contatos" ON "public"."visitante_contatos" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))) WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem criar contatos" ON "public"."visitante_contatos";
CREATE POLICY "Admins podem criar contatos" ON "public"."visitante_contatos" WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem deletar contatos" ON "public"."visitante_contatos";
CREATE POLICY "Admins podem deletar contatos" ON "public"."visitante_contatos" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Admins podem ver todos os contatos" ON "public"."visitante_contatos";
CREATE POLICY "Admins podem ver todos os contatos" ON "public"."visitante_contatos" USING ((has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Church staff podem gerenciar contatos agendados da filial" ON "public"."visitante_contatos";
CREATE POLICY "Church staff podem gerenciar contatos agendados da filial" ON "public"."visitante_contatos" FOR UPDATE USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'professor'::app_role)) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'professor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Church staff podem ver contatos agendados da filial" ON "public"."visitante_contatos";
CREATE POLICY "Church staff podem ver contatos agendados da filial" ON "public"."visitante_contatos" FOR SELECT USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role) OR has_role((select auth.uid()), 'admin_igreja'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role) OR has_role((select auth.uid()), 'lider'::app_role) OR has_role((select auth.uid()), 'secretario'::app_role) OR has_role((select auth.uid()), 'tesoureiro'::app_role) OR has_role((select auth.uid()), 'professor'::app_role)) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros responsáveis podem atualizar seus contatos" ON "public"."visitante_contatos";
CREATE POLICY "Membros responsáveis podem atualizar seus contatos" ON "public"."visitante_contatos" USING (((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id))) WITH CHECK (((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)));
DROP POLICY IF EXISTS "Membros responsáveis podem ver seus contatos" ON "public"."visitante_contatos";
CREATE POLICY "Membros responsáveis podem ver seus contatos" ON "public"."visitante_contatos" USING (((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id)));

-- ==================== visitantes_leads ====================
DROP POLICY IF EXISTS "Admins podem gerenciar visitantes leads" ON "public"."visitantes_leads";
CREATE POLICY "Admins podem gerenciar visitantes leads" ON "public"."visitantes_leads" USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'pastor'::app_role)));
DROP POLICY IF EXISTS "Intercessores podem ver visitantes leads" ON "public"."visitantes_leads";
CREATE POLICY "Intercessores podem ver visitantes leads" ON "public"."visitantes_leads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM intercessores
  WHERE ((intercessores.user_id = (select auth.uid())) AND (intercessores.ativo = true)))));

-- ==================== webhooks ====================
DROP POLICY IF EXISTS "Admins delete webhooks" ON "public"."webhooks";
CREATE POLICY "Admins delete webhooks" ON "public"."webhooks" FOR DELETE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Admins insert webhooks" ON "public"."webhooks";
CREATE POLICY "Admins insert webhooks" ON "public"."webhooks" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Admins podem ver webhooks" ON "public"."webhooks";
CREATE POLICY "Admins podem ver webhooks" ON "public"."webhooks" FOR SELECT TO "authenticated" USING (((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)) AND ((igreja_id IS NULL) OR (igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))))));
DROP POLICY IF EXISTS "Admins update webhooks" ON "public"."webhooks";
CREATE POLICY "Admins update webhooks" ON "public"."webhooks" FOR UPDATE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));

-- ==================== whatsapp_numeros ====================
DROP POLICY IF EXISTS "Admins delete whatsapp_numeros" ON "public"."whatsapp_numeros";
CREATE POLICY "Admins delete whatsapp_numeros" ON "public"."whatsapp_numeros" FOR DELETE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Admins insert whatsapp_numeros" ON "public"."whatsapp_numeros";
CREATE POLICY "Admins insert whatsapp_numeros" ON "public"."whatsapp_numeros" FOR INSERT TO "authenticated" WITH CHECK (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role))));
DROP POLICY IF EXISTS "Admins update whatsapp_numeros" ON "public"."whatsapp_numeros";
CREATE POLICY "Admins update whatsapp_numeros" ON "public"."whatsapp_numeros" FOR UPDATE TO "authenticated" USING (((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'super_admin'::app_role)))) WITH CHECK ((igreja_id IN ( SELECT profiles.igreja_id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DROP POLICY IF EXISTS "Igreja pode ver whatsapp numeros" ON "public"."whatsapp_numeros";
CREATE POLICY "Igreja pode ver whatsapp numeros" ON "public"."whatsapp_numeros" FOR SELECT TO "authenticated" USING (((igreja_id IS NULL) OR (igreja_id IN ( SELECT p.igreja_id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid()))))));
