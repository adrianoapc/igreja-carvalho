-- Fase 2 do achado de performance multiple_permissive_policies (Supabase
-- Performance Advisor, 809 achados / 89 tabelas — ver memória
-- project-supabase-linter-performance-pendente). Sem risco de segurança:
-- Postgres já avalia múltiplas policies PERMISSIVE pra mesma role+ação com
-- OR entre elas por linha; esta migration só faz esse OR explicitamente
-- numa única policy, eliminando a reavaliação redundante por policy.
--
-- Regra de segurança seguida à risca: só mescla policies que já têm o
-- MESMO escopo de role (mesmo TO — incluindo "sem TO" = PUBLIC, que cobre
-- authenticator/dashboard_user/cli_login_postgres/supabase_privileged_role
-- além de anon/authenticated). NUNCA alarga uma policy restrita (TO
-- authenticated) pra PUBLIC nem estreita uma PUBLIC pra um role específico
-- — qualquer uma das duas mudaria o alcance real da policy (a primeira
-- vazaria acesso pra anon; a segunda tiraria acesso dos roles internos do
-- Supabase, cujo uso real por Studio/CLI não dá pra confirmar sem acesso
-- à infra hospedada).
--
-- Consequência dessa regra: uma policy "FOR ALL" que precisa mesclar fica
-- explodida em até 4 policies FOR-específicas (SELECT/INSERT/UPDATE/
-- DELETE) — inclusive nas ações onde ela fica sozinha (sem mescla), pra
-- não perder cobertura ao dropar o original. Por isso o total de policies
-- SOBE (222 dropadas → 314 criadas) mesmo a contagem POR (role,ação) — que
-- é o que o advisor mede — caindo. Nomes novos são curtos e determinísticos
-- (perf_merge_NNN_<ação>_<escopo>) porque nomes de policy são tipo `name`
-- do Postgres (63 bytes, truncamento silencioso) — o mapeamento pra
-- policies originais fica em COMMENT ON POLICY e no comentário acima de
-- cada CREATE.
--
-- Dos 301 pares (tabela, role real, ação) flagados pelo advisor: 255
-- caem pra exatamente 1 policy aplicável (resolvido), 18 melhoram sem
-- zerar (têm um 3º+ grupo de escopo que não colide com os outros 2), e 28
-- ficam iguais — nesses 28, a única forma de reduzir seria violar a regra
-- de escopo acima, então foram deixados intocados (sem regressão, só sem
-- ganho de performance nesse caso específico).
--
-- Gerado por script a partir do dump real (supabase db dump --linked -s
-- public), com verificação estática de cobertura (toda policy tocada
-- reaparece em exatamente 1 saída por ação que ela cobria; nenhuma das
-- 301 células piora) e validado num Postgres local (Docker) restaurado
-- desse dump, aplicado em sequência com a migration da Fase 1: testes
-- funcionais de RLS em igrejas (5 branches mescladas: visão por tenant
-- via current_setting, visão por igreja do perfil, bypass admin, negação
-- pra anon) com resultado idêntico ao pré-merge.
--
-- O dump usado pra extrair os USING/WITH CHECK originais é de ANTES da
-- Fase 1 (auth.uid() ainda "nu", sem o (select ...) da 210000) — achado
-- do /code-review local: sem tratar isso, esta migration reintroduziria
-- auth.uid()/current_setting() sem (select ...) nas 190 policies que
-- também foram tocadas pela Fase 1, desfazendo o fix dela em produção.
-- O gerador agora aplica a MESMA transformação da Fase 1 (wrap_initplan)
-- em cada cláusula antes de combinar com OR — confirmado: 0 ocorrências
-- de auth.uid()/auth.role()/current_setting() sem (select ...) nesta
-- migration (827 chamadas auth.uid(), 3 current_setting(), todas
-- envolvidas).
--
-- REGENERADA em 2026-08-20: a geração original (branch
-- fix-perf-auth-rls-initplan, commit 47a5ccb8) rodou ANTES da PR #124
-- (fecha escrita/leitura anônima cross-tenant — migration
-- 20260820000000) e fundia as policies "Membros visualizam/podem ver X"
-- de 8 tabelas usando a definição PRÉ-fix (sem TO authenticated, sem
-- FOR SELECT explícito) em policies novas `perf_merge_*` — reabriria o
-- mesmo bug crítico sob nomes diferentes. Em vez de re-derivar do zero
-- a lógica de merge (mais arriscado que vale a pena numa 2ª rodada),
-- as 8 seções afetadas foram REMOVIDAS desta migration — essas tabelas
-- ficam com suas policies individuais (já corretas, pós-PR #124),
-- perdendo só o ganho de performance nelas, sem risco de regressão de
-- segurança. Tabelas excluídas: cancoes_culto, escalas, eventos,
-- liturgia_culto, midias_culto, posicoes_time, times, times_culto
-- (`membros_time`, também tocada pela PR #124, não precisou de exclusão
-- — a policy "Membros podem ver membros de times" nunca fez parte de
-- nenhum grupo de merge nesta tabela; confirmado no harness que ela
-- permanece intocada e as `perf_merge_*` geradas aqui cobrem só as
-- policies "Admin/Lider gerencia(m)", mais restritivas). Validado num
-- Postgres local (Docker) restaurado de `supabase db dump --linked -s
-- public` (já pós-PR #124), aplicado em sequência com a Fase 1
-- regenerada: exploit de escrita/leitura anônima (SET ROLE anon sem
-- NENHUM JWT) re-testado nas 8 tabelas excluídas e continua bloqueado.
-- Follow-up (não nesta PR): reduzir multiple_permissive_policies nessas
-- 8 tabelas também, com harness dedicado.



-- ==================== app_permissions ====================
DROP POLICY IF EXISTS "Admins podem gerenciar permissões" ON "public"."app_permissions";
DROP POLICY IF EXISTS "Todos podem ver permissões" ON "public"."app_permissions";
-- merges: Admins podem gerenciar permissões, Todos podem ver permissões
CREATE POLICY "perf_merge_000_select_pub" ON "public"."app_permissions" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (true));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."app_permissions" IS 'perf: merges Admins podem gerenciar permissões, Todos podem ver permissões';
-- merges: Admins podem gerenciar permissões
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."app_permissions" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."app_permissions" IS 'perf: merges Admins podem gerenciar permissões';
-- merges: Admins podem gerenciar permissões
CREATE POLICY "perf_merge_002_update_pub" ON "public"."app_permissions" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."app_permissions" IS 'perf: merges Admins podem gerenciar permissões';
-- merges: Admins podem gerenciar permissões
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."app_permissions" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."app_permissions" IS 'perf: merges Admins podem gerenciar permissões';

-- ==================== app_roles ====================
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON "public"."app_roles";
DROP POLICY IF EXISTS "Todos podem ver roles" ON "public"."app_roles";
-- merges: Admins podem gerenciar roles, Todos podem ver roles
CREATE POLICY "perf_merge_000_select_pub" ON "public"."app_roles" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (true));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."app_roles" IS 'perf: merges Admins podem gerenciar roles, Todos podem ver roles';
-- merges: Admins podem gerenciar roles
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."app_roles" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."app_roles" IS 'perf: merges Admins podem gerenciar roles';
-- merges: Admins podem gerenciar roles
CREATE POLICY "perf_merge_002_update_pub" ON "public"."app_roles" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."app_roles" IS 'perf: merges Admins podem gerenciar roles';
-- merges: Admins podem gerenciar roles
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."app_roles" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."app_roles" IS 'perf: merges Admins podem gerenciar roles';

-- ==================== atendimentos_bot ====================
DROP POLICY IF EXISTS "Admins podem gerenciar atendimentos" ON "public"."atendimentos_bot";
DROP POLICY IF EXISTS "Intercessores podem ver atendimentos" ON "public"."atendimentos_bot";
-- merges: Admins podem gerenciar atendimentos, Intercessores podem ver atendimentos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."atendimentos_bot" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((EXISTS ( SELECT 1
   FROM "public"."intercessores"
  WHERE (("intercessores"."user_id" = (select "auth"."uid"())) AND ("intercessores"."ativo" = true)))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."atendimentos_bot" IS 'perf: merges Admins podem gerenciar atendimentos, Intercessores podem ver atendimentos';
-- merges: Admins podem gerenciar atendimentos
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."atendimentos_bot" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."atendimentos_bot" IS 'perf: merges Admins podem gerenciar atendimentos';
-- merges: Admins podem gerenciar atendimentos
CREATE POLICY "perf_merge_002_update_pub" ON "public"."atendimentos_bot" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."atendimentos_bot" IS 'perf: merges Admins podem gerenciar atendimentos';
-- merges: Admins podem gerenciar atendimentos
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."atendimentos_bot" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."atendimentos_bot" IS 'perf: merges Admins podem gerenciar atendimentos';

-- ==================== atendimentos_pastorais ====================
DROP POLICY IF EXISTS "Pastores e admins gerenciam atendimentos pastorais" ON "public"."atendimentos_pastorais";
DROP POLICY IF EXISTS "Secretarios podem ver agenda" ON "public"."atendimentos_pastorais";
-- merges: Pastores e admins gerenciam atendimentos pastorais, Secretarios podem ver agenda
CREATE POLICY "perf_merge_000_select_pub" ON "public"."atendimentos_pastorais" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."atendimentos_pastorais" IS 'perf: merges Pastores e admins gerenciam atendimentos pastorais, Secretarios podem ver agenda';
-- merges: Pastores e admins gerenciam atendimentos pastorais
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."atendimentos_pastorais" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."atendimentos_pastorais" IS 'perf: merges Pastores e admins gerenciam atendimentos pastorais';
-- merges: Pastores e admins gerenciam atendimentos pastorais
CREATE POLICY "perf_merge_002_update_pub" ON "public"."atendimentos_pastorais" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."atendimentos_pastorais" IS 'perf: merges Pastores e admins gerenciam atendimentos pastorais';
-- merges: Pastores e admins gerenciam atendimentos pastorais
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."atendimentos_pastorais" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."atendimentos_pastorais" IS 'perf: merges Pastores e admins gerenciam atendimentos pastorais';

-- ==================== aulas ====================
DROP POLICY IF EXISTS "Admins podem gerenciar aulas" ON "public"."aulas";
DROP POLICY IF EXISTS "Auth pode ver aulas" ON "public"."aulas";
-- merges: Admins podem gerenciar aulas, Auth pode ver aulas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."aulas" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."aulas" IS 'perf: merges Admins podem gerenciar aulas, Auth pode ver aulas';
-- merges: Admins podem gerenciar aulas
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."aulas" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."aulas" IS 'perf: merges Admins podem gerenciar aulas';
-- merges: Admins podem gerenciar aulas
CREATE POLICY "perf_merge_002_update_pub" ON "public"."aulas" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."aulas" IS 'perf: merges Admins podem gerenciar aulas';
-- merges: Admins podem gerenciar aulas
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."aulas" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."aulas" IS 'perf: merges Admins podem gerenciar aulas';

-- ==================== bases_ministeriais ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar bases ministeriais" ON "public"."bases_ministeriais";
DROP POLICY IF EXISTS "Usuarios podem ver bases ministeriais da igreja" ON "public"."bases_ministeriais";
-- merges: Admins e tesoureiros podem gerenciar bases ministeriais, Usuarios podem ver bases ministeriais da igreja
CREATE POLICY "perf_merge_000_select_pub" ON "public"."bases_ministeriais" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("ativo" = true) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."bases_ministeriais" IS 'perf: merges Admins e tesoureiros podem gerenciar bases ministeriais, Usuarios podem ver bases ministeriais da igreja';
-- merges: Admins e tesoureiros podem gerenciar bases ministeriais
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."bases_ministeriais" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."bases_ministeriais" IS 'perf: merges Admins e tesoureiros podem gerenciar bases ministeriais';
-- merges: Admins e tesoureiros podem gerenciar bases ministeriais
CREATE POLICY "perf_merge_002_update_pub" ON "public"."bases_ministeriais" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."bases_ministeriais" IS 'perf: merges Admins e tesoureiros podem gerenciar bases ministeriais';
-- merges: Admins e tesoureiros podem gerenciar bases ministeriais
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."bases_ministeriais" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."bases_ministeriais" IS 'perf: merges Admins e tesoureiros podem gerenciar bases ministeriais';

-- ==================== candidatos_voluntario ====================
DROP POLICY IF EXISTS "Admins podem gerenciar candidatos" ON "public"."candidatos_voluntario";
DROP POLICY IF EXISTS "Ver própria candidatura" ON "public"."candidatos_voluntario";
-- merges: Admins podem gerenciar candidatos, Ver própria candidatura
CREATE POLICY "perf_merge_000_select_pub" ON "public"."candidatos_voluntario" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."candidatos_voluntario" IS 'perf: merges Admins podem gerenciar candidatos, Ver própria candidatura';
-- merges: Admins podem gerenciar candidatos
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."candidatos_voluntario" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."candidatos_voluntario" IS 'perf: merges Admins podem gerenciar candidatos';
-- merges: Admins podem gerenciar candidatos
CREATE POLICY "perf_merge_002_update_pub" ON "public"."candidatos_voluntario" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."candidatos_voluntario" IS 'perf: merges Admins podem gerenciar candidatos';
-- merges: Admins podem gerenciar candidatos
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."candidatos_voluntario" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."candidatos_voluntario" IS 'perf: merges Admins podem gerenciar candidatos';

-- ==================== categorias_financeiras ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar categorias" ON "public"."categorias_financeiras";
DROP POLICY IF EXISTS "Usuarios podem ver categorias da igreja" ON "public"."categorias_financeiras";
-- merges: Admins e tesoureiros podem gerenciar categorias, Usuarios podem ver categorias da igreja
CREATE POLICY "perf_merge_000_select_pub" ON "public"."categorias_financeiras" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("ativo" = true) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."categorias_financeiras" IS 'perf: merges Admins e tesoureiros podem gerenciar categorias, Usuarios podem ver categorias da igreja';
-- merges: Admins e tesoureiros podem gerenciar categorias
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."categorias_financeiras" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."categorias_financeiras" IS 'perf: merges Admins e tesoureiros podem gerenciar categorias';
-- merges: Admins e tesoureiros podem gerenciar categorias
CREATE POLICY "perf_merge_002_update_pub" ON "public"."categorias_financeiras" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."categorias_financeiras" IS 'perf: merges Admins e tesoureiros podem gerenciar categorias';
-- merges: Admins e tesoureiros podem gerenciar categorias
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."categorias_financeiras" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."categorias_financeiras" IS 'perf: merges Admins e tesoureiros podem gerenciar categorias';

-- ==================== categorias_times ====================
DROP POLICY IF EXISTS "Admins podem gerenciar categorias" ON "public"."categorias_times";
DROP POLICY IF EXISTS "Todos podem ver categorias ativas" ON "public"."categorias_times";
-- merges: Admins podem gerenciar categorias, Todos podem ver categorias ativas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."categorias_times" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((("ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."categorias_times" IS 'perf: merges Admins podem gerenciar categorias, Todos podem ver categorias ativas';
-- merges: Admins podem gerenciar categorias
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."categorias_times" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."categorias_times" IS 'perf: merges Admins podem gerenciar categorias';
-- merges: Admins podem gerenciar categorias
CREATE POLICY "perf_merge_002_update_pub" ON "public"."categorias_times" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."categorias_times" IS 'perf: merges Admins podem gerenciar categorias';
-- merges: Admins podem gerenciar categorias
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."categorias_times" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."categorias_times" IS 'perf: merges Admins podem gerenciar categorias';

-- ==================== centros_custo ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar centros de custo" ON "public"."centros_custo";
DROP POLICY IF EXISTS "Usuarios podem ver centros custo da igreja" ON "public"."centros_custo";
-- merges: Admins e tesoureiros podem gerenciar centros de custo, Usuarios podem ver centros custo da igreja
CREATE POLICY "perf_merge_000_select_pub" ON "public"."centros_custo" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("ativo" = true) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."centros_custo" IS 'perf: merges Admins e tesoureiros podem gerenciar centros de custo, Usuarios podem ver centros custo da igreja';
-- merges: Admins e tesoureiros podem gerenciar centros de custo
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."centros_custo" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."centros_custo" IS 'perf: merges Admins e tesoureiros podem gerenciar centros de custo';
-- merges: Admins e tesoureiros podem gerenciar centros de custo
CREATE POLICY "perf_merge_002_update_pub" ON "public"."centros_custo" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."centros_custo" IS 'perf: merges Admins e tesoureiros podem gerenciar centros de custo';
-- merges: Admins e tesoureiros podem gerenciar centros de custo
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."centros_custo" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."centros_custo" IS 'perf: merges Admins e tesoureiros podem gerenciar centros de custo';

-- ==================== checkins ====================
DROP POLICY IF EXISTS "Lideres gerenciam checkins" ON "public"."checkins";
DROP POLICY IF EXISTS "Membros podem ver checkins" ON "public"."checkins";
-- merges: Lideres gerenciam checkins, Membros podem ver checkins
CREATE POLICY "perf_merge_000_select_pub" ON "public"."checkins" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."checkins" IS 'perf: merges Lideres gerenciam checkins, Membros podem ver checkins';
-- merges: Lideres gerenciam checkins
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."checkins" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."checkins" IS 'perf: merges Lideres gerenciam checkins';
-- merges: Lideres gerenciam checkins
CREATE POLICY "perf_merge_002_update_pub" ON "public"."checkins" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."checkins" IS 'perf: merges Lideres gerenciam checkins';
-- merges: Lideres gerenciam checkins
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."checkins" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."checkins" IS 'perf: merges Lideres gerenciam checkins';

-- ==================== comunicados ====================
DROP POLICY IF EXISTS "comunicados_gestao_admin" ON "public"."comunicados";
DROP POLICY IF EXISTS "comunicados_leitura_publica" ON "public"."comunicados";
-- merges: comunicados_gestao_admin, comunicados_leitura_publica
CREATE POLICY "perf_merge_000_select_pub" ON "public"."comunicados" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("ativo" = true) AND ("data_inicio" <= "now"()) AND (("data_fim" IS NULL) OR ("data_fim" >= "now"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."comunicados" IS 'perf: merges comunicados_gestao_admin, comunicados_leitura_publica';
-- merges: comunicados_gestao_admin
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."comunicados" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."comunicados" IS 'perf: merges comunicados_gestao_admin';
-- merges: comunicados_gestao_admin
CREATE POLICY "perf_merge_002_update_pub" ON "public"."comunicados" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."comunicados" IS 'perf: merges comunicados_gestao_admin';
-- merges: comunicados_gestao_admin
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."comunicados" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."comunicados" IS 'perf: merges comunicados_gestao_admin';

-- ==================== escalas_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar escalas" ON "public"."escalas_culto";
DROP POLICY IF EXISTS "Membros podem ver escalas" ON "public"."escalas_culto";
-- merges: Admins podem gerenciar escalas, Membros podem ver escalas
CREATE POLICY "perf_merge_000_select_auth" ON "public"."escalas_culto" FOR SELECT TO "authenticated" USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."escalas_culto" IS 'perf: merges Admins podem gerenciar escalas, Membros podem ver escalas';
-- merges: Admins podem gerenciar escalas
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."escalas_culto" FOR INSERT TO "authenticated" WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."escalas_culto" IS 'perf: merges Admins podem gerenciar escalas';
-- merges: Admins podem gerenciar escalas
CREATE POLICY "perf_merge_002_update_auth" ON "public"."escalas_culto" FOR UPDATE TO "authenticated" USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."escalas_culto" IS 'perf: merges Admins podem gerenciar escalas';
-- merges: Admins podem gerenciar escalas
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."escalas_culto" FOR DELETE TO "authenticated" USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."escalas_culto" IS 'perf: merges Admins podem gerenciar escalas';

-- ==================== escalas_template ====================
DROP POLICY IF EXISTS "Admins podem gerenciar escalas de templates" ON "public"."escalas_template";
DROP POLICY IF EXISTS "Membros podem ver escalas de templates ativos" ON "public"."escalas_template";
-- merges: Admins podem gerenciar escalas de templates, Membros podem ver escalas de templates ativos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."escalas_template" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((EXISTS ( SELECT 1
   FROM "public"."templates_culto"
  WHERE (("templates_culto"."id" = "escalas_template"."template_id") AND (("templates_culto"."ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."escalas_template" IS 'perf: merges Admins podem gerenciar escalas de templates, Membros podem ver escalas de templates ativos';
-- merges: Admins podem gerenciar escalas de templates
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."escalas_template" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."escalas_template" IS 'perf: merges Admins podem gerenciar escalas de templates';
-- merges: Admins podem gerenciar escalas de templates
CREATE POLICY "perf_merge_002_update_pub" ON "public"."escalas_template" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."escalas_template" IS 'perf: merges Admins podem gerenciar escalas de templates';
-- merges: Admins podem gerenciar escalas de templates
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."escalas_template" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."escalas_template" IS 'perf: merges Admins podem gerenciar escalas de templates';

-- ==================== evento_lotes ====================
DROP POLICY IF EXISTS "Admins podem gerenciar evento_lotes" ON "public"."evento_lotes";
DROP POLICY IF EXISTS "Usuarios podem ver lotes ativos" ON "public"."evento_lotes";
-- merges: Admins podem gerenciar evento_lotes, Usuarios podem ver lotes ativos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."evento_lotes" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (("ativo" = true)));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."evento_lotes" IS 'perf: merges Admins podem gerenciar evento_lotes, Usuarios podem ver lotes ativos';
-- merges: Admins podem gerenciar evento_lotes
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."evento_lotes" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."evento_lotes" IS 'perf: merges Admins podem gerenciar evento_lotes';
-- merges: Admins podem gerenciar evento_lotes
CREATE POLICY "perf_merge_002_update_pub" ON "public"."evento_lotes" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."evento_lotes" IS 'perf: merges Admins podem gerenciar evento_lotes';
-- merges: Admins podem gerenciar evento_lotes
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."evento_lotes" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."evento_lotes" IS 'perf: merges Admins podem gerenciar evento_lotes';

-- ==================== eventos_convites ====================
DROP POLICY IF EXISTS "Admin e lider podem ver todos os convites" ON "public"."eventos_convites";
DROP POLICY IF EXISTS "Admin pode atualizar convites" ON "public"."eventos_convites";
DROP POLICY IF EXISTS "Admin pode criar convites" ON "public"."eventos_convites";
DROP POLICY IF EXISTS "Admin pode deletar convites" ON "public"."eventos_convites";
-- merges: Admin e lider podem ver todos os convites, Admin pode atualizar convites, Admin pode criar convites, Admin pode deletar convites
CREATE POLICY "perf_merge_000_select_pub" ON "public"."eventos_convites" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."eventos_convites" IS 'perf: merges Admin e lider podem ver todos os convites, Admin pode atualizar convites, Admin pode criar convites, Admin pode deletar convites';
-- merges: Admin e lider podem ver todos os convites, Admin pode atualizar convites, Admin pode criar convites, Admin pode deletar convites
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."eventos_convites" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."eventos_convites" IS 'perf: merges Admin e lider podem ver todos os convites, Admin pode atualizar convites, Admin pode criar convites, Admin pode deletar convites';
-- merges: Admin e lider podem ver todos os convites, Admin pode atualizar convites, Admin pode criar convites, Admin pode deletar convites
CREATE POLICY "perf_merge_002_update_pub" ON "public"."eventos_convites" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."eventos_convites" IS 'perf: merges Admin e lider podem ver todos os convites, Admin pode atualizar convites, Admin pode criar convites, Admin pode deletar convites';
-- merges: Admin e lider podem ver todos os convites, Admin pode atualizar convites, Admin pode criar convites, Admin pode deletar convites
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."eventos_convites" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."eventos_convites" IS 'perf: merges Admin e lider podem ver todos os convites, Admin pode atualizar convites, Admin pode criar convites, Admin pode deletar convites';

-- ==================== familias ====================
DROP POLICY IF EXISTS "Admins podem atualizar relacionamentos familiares" ON "public"."familias";
DROP POLICY IF EXISTS "Admins podem criar relacionamentos familiares" ON "public"."familias";
DROP POLICY IF EXISTS "Admins podem deletar relacionamentos familiares" ON "public"."familias";
DROP POLICY IF EXISTS "Admins podem ver todos os relacionamentos familiares" ON "public"."familias";
DROP POLICY IF EXISTS "admins_can_manage_families" ON "public"."familias";
DROP POLICY IF EXISTS "members_can_create_family_relationships" ON "public"."familias";
-- merges: Admins podem atualizar relacionamentos familiares, Admins podem criar relacionamentos familiares, Admins podem deletar relacionamentos familiares, Admins podem ver todos os relacionamentos familiares, admins_can_manage_families
CREATE POLICY "perf_merge_000_select_pub" ON "public"."familias" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."familias" IS 'perf: merges Admins podem atualizar relacionamentos familiares, Admins podem criar relacionamentos familiares, Admins podem deletar relacionamentos familiares, Admins podem ver todos os relacionamentos familiares, admins_can_manage_families';
-- merges: Admins podem atualizar relacionamentos familiares, Admins podem criar relacionamentos familiares, Admins podem deletar relacionamentos familiares, Admins podem ver todos os relacionamentos familiares, admins_can_manage_families, members_can_create_family_relationships
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."familias" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."familias" IS 'perf: merges Admins podem atualizar relacionamentos familiares, Admins podem criar relacionamentos familiares, Admins podem deletar relacionamentos familiares, Admins podem ver todos os relacionamentos familiares, admins_can_manage_families, members_can_create_family_relationships';
-- merges: Admins podem atualizar relacionamentos familiares, Admins podem criar relacionamentos familiares, Admins podem deletar relacionamentos familiares, Admins podem ver todos os relacionamentos familiares, admins_can_manage_families
CREATE POLICY "perf_merge_002_update_pub" ON "public"."familias" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."familias" IS 'perf: merges Admins podem atualizar relacionamentos familiares, Admins podem criar relacionamentos familiares, Admins podem deletar relacionamentos familiares, Admins podem ver todos os relacionamentos familiares, admins_can_manage_families';
-- merges: Admins podem atualizar relacionamentos familiares, Admins podem criar relacionamentos familiares, Admins podem deletar relacionamentos familiares, Admins podem ver todos os relacionamentos familiares, admins_can_manage_families
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."familias" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."familias" IS 'perf: merges Admins podem atualizar relacionamentos familiares, Admins podem criar relacionamentos familiares, Admins podem deletar relacionamentos familiares, Admins podem ver todos os relacionamentos familiares, admins_can_manage_families';

-- ==================== filiais ====================
DROP POLICY IF EXISTS "Igreja admin pode gerenciar filiais" ON "public"."filiais";
DROP POLICY IF EXISTS "Usuários autenticados veem filiais da sua igreja" ON "public"."filiais";
-- merges: Igreja admin pode gerenciar filiais, Usuários autenticados veem filiais da sua igreja
CREATE POLICY "perf_merge_000_select_auth" ON "public"."filiais" FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = 'super_admin'::"public"."app_role")))) OR (("igreja_id" IN ( SELECT "p"."igreja_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = (select "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'pastor'::"public"."app_role"])))))))) OR ((("igreja_id" = "public"."get_jwt_igreja_id"()) OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."filiais" IS 'perf: merges Igreja admin pode gerenciar filiais, Usuários autenticados veem filiais da sua igreja';
-- merges: Igreja admin pode gerenciar filiais
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."filiais" FOR INSERT TO "authenticated" WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = 'super_admin'::"public"."app_role")))) OR (("igreja_id" IN ( SELECT "p"."igreja_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = (select "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'pastor'::"public"."app_role"])))))))));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."filiais" IS 'perf: merges Igreja admin pode gerenciar filiais';
-- merges: Igreja admin pode gerenciar filiais
CREATE POLICY "perf_merge_002_update_auth" ON "public"."filiais" FOR UPDATE TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = 'super_admin'::"public"."app_role")))) OR (("igreja_id" IN ( SELECT "p"."igreja_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = (select "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'pastor'::"public"."app_role"]))))))))) WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = 'super_admin'::"public"."app_role")))) OR (("igreja_id" IN ( SELECT "p"."igreja_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = (select "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'pastor'::"public"."app_role"])))))))));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."filiais" IS 'perf: merges Igreja admin pode gerenciar filiais';
-- merges: Igreja admin pode gerenciar filiais
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."filiais" FOR DELETE TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = 'super_admin'::"public"."app_role")))) OR (("igreja_id" IN ( SELECT "p"."igreja_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."user_id" = (select "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = (select "auth"."uid"())) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'pastor'::"public"."app_role"])))))))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."filiais" IS 'perf: merges Igreja admin pode gerenciar filiais';

-- ==================== forma_pagamento_contas ====================
DROP POLICY IF EXISTS "Admin edita mapeamentos" ON "public"."forma_pagamento_contas";
DROP POLICY IF EXISTS "Ver mapeamentos da própria igreja" ON "public"."forma_pagamento_contas";
-- merges: Admin edita mapeamentos, Ver mapeamentos da própria igreja
CREATE POLICY "perf_merge_000_select_pub" ON "public"."forma_pagamento_contas" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."forma_pagamento_contas" IS 'perf: merges Admin edita mapeamentos, Ver mapeamentos da própria igreja';
-- merges: Admin edita mapeamentos
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."forma_pagamento_contas" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."forma_pagamento_contas" IS 'perf: merges Admin edita mapeamentos';
-- merges: Admin edita mapeamentos
CREATE POLICY "perf_merge_002_update_pub" ON "public"."forma_pagamento_contas" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."forma_pagamento_contas" IS 'perf: merges Admin edita mapeamentos';
-- merges: Admin edita mapeamentos
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."forma_pagamento_contas" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."forma_pagamento_contas" IS 'perf: merges Admin edita mapeamentos';

-- ==================== formas_pagamento ====================
DROP POLICY IF EXISTS "Admins e tesoureiros gerenciam formas pagamento" ON "public"."formas_pagamento";
DROP POLICY IF EXISTS "Usuarios autenticados podem ver formas pagamento ativas" ON "public"."formas_pagamento";
-- merges: Admins e tesoureiros gerenciam formas pagamento, Usuarios autenticados podem ver formas pagamento ativas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."formas_pagamento" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("ativo" = true) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."formas_pagamento" IS 'perf: merges Admins e tesoureiros gerenciam formas pagamento, Usuarios autenticados podem ver formas pagamento ativas';
-- merges: Admins e tesoureiros gerenciam formas pagamento
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."formas_pagamento" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."formas_pagamento" IS 'perf: merges Admins e tesoureiros gerenciam formas pagamento';
-- merges: Admins e tesoureiros gerenciam formas pagamento
CREATE POLICY "perf_merge_002_update_pub" ON "public"."formas_pagamento" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."formas_pagamento" IS 'perf: merges Admins e tesoureiros gerenciam formas pagamento';
-- merges: Admins e tesoureiros gerenciam formas pagamento
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."formas_pagamento" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."formas_pagamento" IS 'perf: merges Admins e tesoureiros gerenciam formas pagamento';

-- ==================== fornecedores ====================
DROP POLICY IF EXISTS "only_admins_can_delete_suppliers" ON "public"."fornecedores";
DROP POLICY IF EXISTS "only_admins_treasurers_can_create_suppliers" ON "public"."fornecedores";
DROP POLICY IF EXISTS "only_admins_treasurers_can_update_suppliers" ON "public"."fornecedores";
DROP POLICY IF EXISTS "only_admins_treasurers_can_view_suppliers" ON "public"."fornecedores";
-- merges: only_admins_can_delete_suppliers, only_admins_treasurers_can_create_suppliers, only_admins_treasurers_can_update_suppliers, only_admins_treasurers_can_view_suppliers
CREATE POLICY "perf_merge_000_select_pub" ON "public"."fornecedores" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND ((select "auth"."uid"()) IS NOT NULL) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."fornecedores" IS 'perf: merges only_admins_can_delete_suppliers, only_admins_treasurers_can_create_suppliers, only_admins_treasurers_can_update_suppliers, only_admins_treasurers_can_view_suppliers';
-- merges: only_admins_can_delete_suppliers, only_admins_treasurers_can_create_suppliers, only_admins_treasurers_can_update_suppliers
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."fornecedores" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."fornecedores" IS 'perf: merges only_admins_can_delete_suppliers, only_admins_treasurers_can_create_suppliers, only_admins_treasurers_can_update_suppliers';
-- merges: only_admins_can_delete_suppliers, only_admins_treasurers_can_create_suppliers, only_admins_treasurers_can_update_suppliers
CREATE POLICY "perf_merge_002_update_pub" ON "public"."fornecedores" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."fornecedores" IS 'perf: merges only_admins_can_delete_suppliers, only_admins_treasurers_can_create_suppliers, only_admins_treasurers_can_update_suppliers';
-- merges: only_admins_can_delete_suppliers, only_admins_treasurers_can_create_suppliers, only_admins_treasurers_can_update_suppliers
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."fornecedores" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."fornecedores" IS 'perf: merges only_admins_can_delete_suppliers, only_admins_treasurers_can_create_suppliers, only_admins_treasurers_can_update_suppliers';

-- ==================== funcoes_igreja ====================
DROP POLICY IF EXISTS "Admins podem gerenciar funcoes" ON "public"."funcoes_igreja";
DROP POLICY IF EXISTS "Todos podem ver funcoes ativas" ON "public"."funcoes_igreja";
-- merges: Admins podem gerenciar funcoes, Todos podem ver funcoes ativas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."funcoes_igreja" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((("ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."funcoes_igreja" IS 'perf: merges Admins podem gerenciar funcoes, Todos podem ver funcoes ativas';
-- merges: Admins podem gerenciar funcoes
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."funcoes_igreja" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."funcoes_igreja" IS 'perf: merges Admins podem gerenciar funcoes';
-- merges: Admins podem gerenciar funcoes
CREATE POLICY "perf_merge_002_update_pub" ON "public"."funcoes_igreja" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."funcoes_igreja" IS 'perf: merges Admins podem gerenciar funcoes';
-- merges: Admins podem gerenciar funcoes
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."funcoes_igreja" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."funcoes_igreja" IS 'perf: merges Admins podem gerenciar funcoes';

-- ==================== getnet_ajustes ====================
DROP POLICY IF EXISTS "getnet_ajustes_modify" ON "public"."getnet_ajustes";
DROP POLICY IF EXISTS "getnet_ajustes_select" ON "public"."getnet_ajustes";
-- merges: getnet_ajustes_modify, getnet_ajustes_select
CREATE POLICY "perf_merge_000_select_auth" ON "public"."getnet_ajustes" FOR SELECT TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))) OR ((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."getnet_ajustes" IS 'perf: merges getnet_ajustes_modify, getnet_ajustes_select';
-- merges: getnet_ajustes_modify
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."getnet_ajustes" FOR INSERT TO "authenticated" WITH CHECK ((("igreja_id" = "public"."get_current_user_igreja_id"())));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."getnet_ajustes" IS 'perf: merges getnet_ajustes_modify';
-- merges: getnet_ajustes_modify
CREATE POLICY "perf_merge_002_update_auth" ON "public"."getnet_ajustes" FOR UPDATE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))))) WITH CHECK ((("igreja_id" = "public"."get_current_user_igreja_id"())));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."getnet_ajustes" IS 'perf: merges getnet_ajustes_modify';
-- merges: getnet_ajustes_modify
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."getnet_ajustes" FOR DELETE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."getnet_ajustes" IS 'perf: merges getnet_ajustes_modify';

-- ==================== getnet_analitico ====================
DROP POLICY IF EXISTS "getnet_analitico_modify" ON "public"."getnet_analitico";
DROP POLICY IF EXISTS "getnet_analitico_select" ON "public"."getnet_analitico";
-- merges: getnet_analitico_modify, getnet_analitico_select
CREATE POLICY "perf_merge_000_select_auth" ON "public"."getnet_analitico" FOR SELECT TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))) OR ((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."getnet_analitico" IS 'perf: merges getnet_analitico_modify, getnet_analitico_select';
-- merges: getnet_analitico_modify
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."getnet_analitico" FOR INSERT TO "authenticated" WITH CHECK ((("igreja_id" = "public"."get_current_user_igreja_id"())));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."getnet_analitico" IS 'perf: merges getnet_analitico_modify';
-- merges: getnet_analitico_modify
CREATE POLICY "perf_merge_002_update_auth" ON "public"."getnet_analitico" FOR UPDATE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))))) WITH CHECK ((("igreja_id" = "public"."get_current_user_igreja_id"())));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."getnet_analitico" IS 'perf: merges getnet_analitico_modify';
-- merges: getnet_analitico_modify
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."getnet_analitico" FOR DELETE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."getnet_analitico" IS 'perf: merges getnet_analitico_modify';

-- ==================== getnet_arquivos ====================
DROP POLICY IF EXISTS "getnet_arquivos_modify" ON "public"."getnet_arquivos";
DROP POLICY IF EXISTS "getnet_arquivos_select" ON "public"."getnet_arquivos";
-- merges: getnet_arquivos_modify, getnet_arquivos_select
CREATE POLICY "perf_merge_000_select_auth" ON "public"."getnet_arquivos" FOR SELECT TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))) OR ((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."getnet_arquivos" IS 'perf: merges getnet_arquivos_modify, getnet_arquivos_select';
-- merges: getnet_arquivos_modify
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."getnet_arquivos" FOR INSERT TO "authenticated" WITH CHECK ((("igreja_id" = "public"."get_current_user_igreja_id"())));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."getnet_arquivos" IS 'perf: merges getnet_arquivos_modify';
-- merges: getnet_arquivos_modify
CREATE POLICY "perf_merge_002_update_auth" ON "public"."getnet_arquivos" FOR UPDATE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))))) WITH CHECK ((("igreja_id" = "public"."get_current_user_igreja_id"())));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."getnet_arquivos" IS 'perf: merges getnet_arquivos_modify';
-- merges: getnet_arquivos_modify
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."getnet_arquivos" FOR DELETE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."getnet_arquivos" IS 'perf: merges getnet_arquivos_modify';

-- ==================== getnet_financeiro_detalhe ====================
DROP POLICY IF EXISTS "getnet_fin_detalhe_modify" ON "public"."getnet_financeiro_detalhe";
DROP POLICY IF EXISTS "getnet_fin_detalhe_select" ON "public"."getnet_financeiro_detalhe";
-- merges: getnet_fin_detalhe_modify, getnet_fin_detalhe_select
CREATE POLICY "perf_merge_000_select_auth" ON "public"."getnet_financeiro_detalhe" FOR SELECT TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))) OR ((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."getnet_financeiro_detalhe" IS 'perf: merges getnet_fin_detalhe_modify, getnet_fin_detalhe_select';
-- merges: getnet_fin_detalhe_modify
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."getnet_financeiro_detalhe" FOR INSERT TO "authenticated" WITH CHECK ((("igreja_id" = "public"."get_current_user_igreja_id"())));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."getnet_financeiro_detalhe" IS 'perf: merges getnet_fin_detalhe_modify';
-- merges: getnet_fin_detalhe_modify
CREATE POLICY "perf_merge_002_update_auth" ON "public"."getnet_financeiro_detalhe" FOR UPDATE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))))) WITH CHECK ((("igreja_id" = "public"."get_current_user_igreja_id"())));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."getnet_financeiro_detalhe" IS 'perf: merges getnet_fin_detalhe_modify';
-- merges: getnet_fin_detalhe_modify
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."getnet_financeiro_detalhe" FOR DELETE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."getnet_financeiro_detalhe" IS 'perf: merges getnet_fin_detalhe_modify';

-- ==================== getnet_financeiro_resumo ====================
DROP POLICY IF EXISTS "getnet_fin_resumo_modify" ON "public"."getnet_financeiro_resumo";
DROP POLICY IF EXISTS "getnet_fin_resumo_select" ON "public"."getnet_financeiro_resumo";
-- merges: getnet_fin_resumo_modify, getnet_fin_resumo_select
CREATE POLICY "perf_merge_000_select_auth" ON "public"."getnet_financeiro_resumo" FOR SELECT TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."integracoes_financeiras" "i"
  WHERE (("i"."id" = "getnet_financeiro_resumo"."integracao_id") AND "public"."has_filial_access"("i"."igreja_id", "i"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))) OR ((("igreja_id" = "public"."get_current_user_igreja_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."integracoes_financeiras" "i"
  WHERE (("i"."id" = "getnet_financeiro_resumo"."integracao_id") AND "public"."has_filial_access"("i"."igreja_id", "i"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."getnet_financeiro_resumo" IS 'perf: merges getnet_fin_resumo_modify, getnet_fin_resumo_select';
-- merges: getnet_fin_resumo_modify
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."getnet_financeiro_resumo" FOR INSERT TO "authenticated" WITH CHECK (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."integracoes_financeiras" "i"
  WHERE (("i"."id" = "getnet_financeiro_resumo"."integracao_id") AND "public"."has_filial_access"("i"."igreja_id", "i"."filial_id")))))));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."getnet_financeiro_resumo" IS 'perf: merges getnet_fin_resumo_modify';
-- merges: getnet_fin_resumo_modify
CREATE POLICY "perf_merge_002_update_auth" ON "public"."getnet_financeiro_resumo" FOR UPDATE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."integracoes_financeiras" "i"
  WHERE (("i"."id" = "getnet_financeiro_resumo"."integracao_id") AND "public"."has_filial_access"("i"."igreja_id", "i"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))))) WITH CHECK (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."integracoes_financeiras" "i"
  WHERE (("i"."id" = "getnet_financeiro_resumo"."integracao_id") AND "public"."has_filial_access"("i"."igreja_id", "i"."filial_id")))))));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."getnet_financeiro_resumo" IS 'perf: merges getnet_fin_resumo_modify';
-- merges: getnet_fin_resumo_modify
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."getnet_financeiro_resumo" FOR DELETE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."integracoes_financeiras" "i"
  WHERE (("i"."id" = "getnet_financeiro_resumo"."integracao_id") AND "public"."has_filial_access"("i"."igreja_id", "i"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."getnet_financeiro_resumo" IS 'perf: merges getnet_fin_resumo_modify';

-- ==================== getnet_resumo ====================
DROP POLICY IF EXISTS "getnet_resumo_modify" ON "public"."getnet_resumo";
DROP POLICY IF EXISTS "getnet_resumo_select" ON "public"."getnet_resumo";
-- merges: getnet_resumo_modify, getnet_resumo_select
CREATE POLICY "perf_merge_000_select_auth" ON "public"."getnet_resumo" FOR SELECT TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND "public"."has_filial_access"("igreja_id", "filial_id") AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))) OR ((("igreja_id" = "public"."get_current_user_igreja_id"()) AND "public"."has_filial_access"("igreja_id", "filial_id") AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."getnet_resumo" IS 'perf: merges getnet_resumo_modify, getnet_resumo_select';
-- merges: getnet_resumo_modify
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."getnet_resumo" FOR INSERT TO "authenticated" WITH CHECK (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."getnet_resumo" IS 'perf: merges getnet_resumo_modify';
-- merges: getnet_resumo_modify
CREATE POLICY "perf_merge_002_update_auth" ON "public"."getnet_resumo" FOR UPDATE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND "public"."has_filial_access"("igreja_id", "filial_id") AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))))) WITH CHECK (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."getnet_resumo" IS 'perf: merges getnet_resumo_modify';
-- merges: getnet_resumo_modify
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."getnet_resumo" FOR DELETE TO "authenticated" USING (((("igreja_id" = "public"."get_current_user_igreja_id"()) AND "public"."has_filial_access"("igreja_id", "filial_id") AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."getnet_resumo" IS 'perf: merges getnet_resumo_modify';

-- ==================== igrejas ====================
DROP POLICY IF EXISTS "Admin igreja pode ver sua igreja" ON "public"."igrejas";
DROP POLICY IF EXISTS "Admins podem atualizar igreja" ON "public"."igrejas";
DROP POLICY IF EXISTS "Admins podem gerenciar igrejas" ON "public"."igrejas";
DROP POLICY IF EXISTS "Igreja pode ser vista pelo tenant" ON "public"."igrejas";
DROP POLICY IF EXISTS "Super admin pode gerenciar igrejas" ON "public"."igrejas";
DROP POLICY IF EXISTS "Super admin pode ver todas igrejas" ON "public"."igrejas";
-- merges: Admin igreja pode ver sua igreja, Admins podem gerenciar igrejas, Igreja pode ser vista pelo tenant, Super admin pode gerenciar igrejas, Super admin pode ver todas igrejas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."igrejas" FOR SELECT USING ((("id" = "public"."get_current_user_igreja_id"())) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (("id" = (NULLIF((select "current_setting"('request.jwt.claim.igreja_id'::"text", true)), ''::"text"))::"uuid")) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."igrejas" IS 'perf: merges Admin igreja pode ver sua igreja, Admins podem gerenciar igrejas, Igreja pode ser vista pelo tenant, Super admin pode gerenciar igrejas, Super admin pode ver todas igrejas';
-- merges: Admins podem gerenciar igrejas, Super admin pode gerenciar igrejas
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."igrejas" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."igrejas" IS 'perf: merges Admins podem gerenciar igrejas, Super admin pode gerenciar igrejas';
-- merges: Admins podem atualizar igreja, Admins podem gerenciar igrejas, Super admin pode gerenciar igrejas
CREATE POLICY "perf_merge_002_update_pub" ON "public"."igrejas" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND ("id" = (NULLIF((select "current_setting"('request.jwt.claim.igreja_id'::"text", true)), ''::"text"))::"uuid"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))) WITH CHECK ((("id" = (NULLIF((select "current_setting"('request.jwt.claim.igreja_id'::"text", true)), ''::"text"))::"uuid")) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."igrejas" IS 'perf: merges Admins podem atualizar igreja, Admins podem gerenciar igrejas, Super admin pode gerenciar igrejas';
-- merges: Admins podem gerenciar igrejas, Super admin pode gerenciar igrejas
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."igrejas" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."igrejas" IS 'perf: merges Admins podem gerenciar igrejas, Super admin pode gerenciar igrejas';

-- ==================== inscricoes_eventos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar inscricoes_eventos" ON "public"."inscricoes_eventos";
DROP POLICY IF EXISTS "Usuarios podem criar proprias inscricoes" ON "public"."inscricoes_eventos";
DROP POLICY IF EXISTS "Usuarios podem ver proprias inscricoes" ON "public"."inscricoes_eventos";
-- merges: Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes, Usuarios podem ver proprias inscricoes
CREATE POLICY "perf_merge_000_select_pub" ON "public"."inscricoes_eventos" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."inscricoes_eventos" IS 'perf: merges Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes, Usuarios podem ver proprias inscricoes';
-- merges: Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes, Usuarios podem ver proprias inscricoes
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."inscricoes_eventos" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."inscricoes_eventos" IS 'perf: merges Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes, Usuarios podem ver proprias inscricoes';
-- merges: Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes, Usuarios podem ver proprias inscricoes
CREATE POLICY "perf_merge_002_update_pub" ON "public"."inscricoes_eventos" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."inscricoes_eventos" IS 'perf: merges Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes, Usuarios podem ver proprias inscricoes';
-- merges: Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes, Usuarios podem ver proprias inscricoes
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."inscricoes_eventos" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."inscricoes_eventos" IS 'perf: merges Admins podem gerenciar inscricoes_eventos, Usuarios podem criar proprias inscricoes, Usuarios podem ver proprias inscricoes';

-- ==================== inscricoes_jornada ====================
DROP POLICY IF EXISTS "Admins podem gerenciar inscrições" ON "public"."inscricoes_jornada";
DROP POLICY IF EXISTS "Admins podem ver todas inscrições" ON "public"."inscricoes_jornada";
DROP POLICY IF EXISTS "Membros podem ver própria inscrição" ON "public"."inscricoes_jornada";
DROP POLICY IF EXISTS "Responsáveis podem ver suas inscrições" ON "public"."inscricoes_jornada";
-- merges: Admins podem gerenciar inscrições, Admins podem ver todas inscrições, Membros podem ver própria inscrição, Responsáveis podem ver suas inscrições
CREATE POLICY "perf_merge_000_select_pub" ON "public"."inscricoes_jornada" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))) OR (("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."inscricoes_jornada" IS 'perf: merges Admins podem gerenciar inscrições, Admins podem ver todas inscrições, Membros podem ver própria inscrição, Responsáveis podem ver suas inscrições';
-- merges: Admins podem gerenciar inscrições
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."inscricoes_jornada" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."inscricoes_jornada" IS 'perf: merges Admins podem gerenciar inscrições';
-- merges: Admins podem gerenciar inscrições
CREATE POLICY "perf_merge_002_update_pub" ON "public"."inscricoes_jornada" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."inscricoes_jornada" IS 'perf: merges Admins podem gerenciar inscrições';
-- merges: Admins podem gerenciar inscrições
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."inscricoes_jornada" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."inscricoes_jornada" IS 'perf: merges Admins podem gerenciar inscrições';

-- ==================== integracao_voluntario ====================
DROP POLICY IF EXISTS "Admin e lider gerenciam integrações" ON "public"."integracao_voluntario";
DROP POLICY IF EXISTS "Mentores e admin veem integrações" ON "public"."integracao_voluntario";
-- merges: Admin e lider gerenciam integrações, Mentores e admin veem integrações
CREATE POLICY "perf_merge_000_select_pub" ON "public"."integracao_voluntario" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))) OR ((("mentor_id" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."integracao_voluntario" IS 'perf: merges Admin e lider gerenciam integrações, Mentores e admin veem integrações';
-- merges: Admin e lider gerenciam integrações
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."integracao_voluntario" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."integracao_voluntario" IS 'perf: merges Admin e lider gerenciam integrações';
-- merges: Admin e lider gerenciam integrações
CREATE POLICY "perf_merge_002_update_pub" ON "public"."integracao_voluntario" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."integracao_voluntario" IS 'perf: merges Admin e lider gerenciam integrações';
-- merges: Admin e lider gerenciam integrações
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."integracao_voluntario" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."integracao_voluntario" IS 'perf: merges Admin e lider gerenciam integrações';

-- ==================== intercessores ====================
DROP POLICY IF EXISTS "Admins e intercessores podem ver intercessores" ON "public"."intercessores";
DROP POLICY IF EXISTS "Admins podem gerenciar intercessores" ON "public"."intercessores";
DROP POLICY IF EXISTS "Intercessores podem ver seu próprio perfil" ON "public"."intercessores";
-- merges: Admins e intercessores podem ver intercessores, Admins podem gerenciar intercessores, Intercessores podem ver seu próprio perfil
CREATE POLICY "perf_merge_000_select_pub" ON "public"."intercessores" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role") OR ("user_id" = (select "auth"."uid"()))) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((select "auth"."uid"()) = "user_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."intercessores" IS 'perf: merges Admins e intercessores podem ver intercessores, Admins podem gerenciar intercessores, Intercessores podem ver seu próprio perfil';
-- merges: Admins podem gerenciar intercessores
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."intercessores" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."intercessores" IS 'perf: merges Admins podem gerenciar intercessores';
-- merges: Admins podem gerenciar intercessores
CREATE POLICY "perf_merge_002_update_pub" ON "public"."intercessores" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."intercessores" IS 'perf: merges Admins podem gerenciar intercessores';
-- merges: Admins podem gerenciar intercessores
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."intercessores" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."intercessores" IS 'perf: merges Admins podem gerenciar intercessores';

-- ==================== itens_reembolso ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar itens" ON "public"."itens_reembolso";
DROP POLICY IF EXISTS "Admins e tesoureiros podem ver todos itens" ON "public"."itens_reembolso";
DROP POLICY IF EXISTS "Ver itens dos próprios reembolsos" ON "public"."itens_reembolso";
-- merges: Admins e tesoureiros podem gerenciar itens, Admins e tesoureiros podem ver todos itens, Ver itens dos próprios reembolsos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."itens_reembolso" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("solicitacao_id" IN ( SELECT "solicitacoes_reembolso"."id"
   FROM "public"."solicitacoes_reembolso"
  WHERE ("solicitacoes_reembolso"."solicitante_id" IN ( SELECT "profiles"."id"
           FROM "public"."profiles"
          WHERE ("profiles"."user_id" = (select "auth"."uid"())))))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."itens_reembolso" IS 'perf: merges Admins e tesoureiros podem gerenciar itens, Admins e tesoureiros podem ver todos itens, Ver itens dos próprios reembolsos';
-- merges: Admins e tesoureiros podem gerenciar itens
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."itens_reembolso" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."itens_reembolso" IS 'perf: merges Admins e tesoureiros podem gerenciar itens';
-- merges: Admins e tesoureiros podem gerenciar itens
CREATE POLICY "perf_merge_002_update_pub" ON "public"."itens_reembolso" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."itens_reembolso" IS 'perf: merges Admins e tesoureiros podem gerenciar itens';
-- merges: Admins e tesoureiros podem gerenciar itens
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."itens_reembolso" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."itens_reembolso" IS 'perf: merges Admins e tesoureiros podem gerenciar itens';

-- ==================== itens_template_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar itens de templates" ON "public"."itens_template_culto";
DROP POLICY IF EXISTS "Membros podem ver itens de templates ativos" ON "public"."itens_template_culto";
-- merges: Admins podem gerenciar itens de templates, Membros podem ver itens de templates ativos
CREATE POLICY "perf_merge_000_select_auth" ON "public"."itens_template_culto" FOR SELECT TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ((EXISTS ( SELECT 1
   FROM "public"."templates_culto"
  WHERE (("templates_culto"."id" = "itens_template_culto"."template_id") AND (("templates_culto"."ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")))))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."itens_template_culto" IS 'perf: merges Admins podem gerenciar itens de templates, Membros podem ver itens de templates ativos';
-- merges: Admins podem gerenciar itens de templates
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."itens_template_culto" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."itens_template_culto" IS 'perf: merges Admins podem gerenciar itens de templates';
-- merges: Admins podem gerenciar itens de templates
CREATE POLICY "perf_merge_002_update_auth" ON "public"."itens_template_culto" FOR UPDATE TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."itens_template_culto" IS 'perf: merges Admins podem gerenciar itens de templates';
-- merges: Admins podem gerenciar itens de templates
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."itens_template_culto" FOR DELETE TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."itens_template_culto" IS 'perf: merges Admins podem gerenciar itens de templates';

-- ==================== itens_template_liturgia ====================
DROP POLICY IF EXISTS "Admins podem gerenciar itens de templates" ON "public"."itens_template_liturgia";
DROP POLICY IF EXISTS "Membros podem ver itens de templates ativos" ON "public"."itens_template_liturgia";
-- merges: Admins podem gerenciar itens de templates, Membros podem ver itens de templates ativos
CREATE POLICY "perf_merge_000_select_auth" ON "public"."itens_template_liturgia" FOR SELECT TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ((EXISTS ( SELECT 1
   FROM "public"."templates_liturgia"
  WHERE (("templates_liturgia"."id" = "itens_template_liturgia"."template_id") AND (("templates_liturgia"."ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")))))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."itens_template_liturgia" IS 'perf: merges Admins podem gerenciar itens de templates, Membros podem ver itens de templates ativos';
-- merges: Admins podem gerenciar itens de templates
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."itens_template_liturgia" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."itens_template_liturgia" IS 'perf: merges Admins podem gerenciar itens de templates';
-- merges: Admins podem gerenciar itens de templates
CREATE POLICY "perf_merge_002_update_auth" ON "public"."itens_template_liturgia" FOR UPDATE TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."itens_template_liturgia" IS 'perf: merges Admins podem gerenciar itens de templates';
-- merges: Admins podem gerenciar itens de templates
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."itens_template_liturgia" FOR DELETE TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."itens_template_liturgia" IS 'perf: merges Admins podem gerenciar itens de templates';

-- ==================== jornadas ====================
DROP POLICY IF EXISTS "Admins podem gerenciar jornadas" ON "public"."jornadas";
DROP POLICY IF EXISTS "Todos podem ver jornadas ativas" ON "public"."jornadas";
-- merges: Admins podem gerenciar jornadas, Todos podem ver jornadas ativas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."jornadas" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((("ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."jornadas" IS 'perf: merges Admins podem gerenciar jornadas, Todos podem ver jornadas ativas';
-- merges: Admins podem gerenciar jornadas
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."jornadas" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."jornadas" IS 'perf: merges Admins podem gerenciar jornadas';
-- merges: Admins podem gerenciar jornadas
CREATE POLICY "perf_merge_002_update_pub" ON "public"."jornadas" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."jornadas" IS 'perf: merges Admins podem gerenciar jornadas';
-- merges: Admins podem gerenciar jornadas
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."jornadas" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."jornadas" IS 'perf: merges Admins podem gerenciar jornadas';

-- ==================== kids_checkins ====================
DROP POLICY IF EXISTS "Pais podem fazer checkout dos filhos" ON "public"."kids_checkins";
DROP POLICY IF EXISTS "Responsaveis podem ver checkins dos filhos" ON "public"."kids_checkins";
DROP POLICY IF EXISTS "Staff pode gerenciar checkins kids" ON "public"."kids_checkins";
-- merges: Responsaveis podem ver checkins dos filhos, Staff pode gerenciar checkins kids
CREATE POLICY "perf_merge_000_select_pub" ON "public"."kids_checkins" FOR SELECT USING (((("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."kids_checkins" IS 'perf: merges Responsaveis podem ver checkins dos filhos, Staff pode gerenciar checkins kids';
-- merges: Staff pode gerenciar checkins kids
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."kids_checkins" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."kids_checkins" IS 'perf: merges Staff pode gerenciar checkins kids';
-- merges: Pais podem fazer checkout dos filhos, Staff pode gerenciar checkins kids
CREATE POLICY "perf_merge_002_update_pub" ON "public"."kids_checkins" FOR UPDATE USING (((("responsavel_id" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND ("checkout_at" IS NULL))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("responsavel_id" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."kids_checkins" IS 'perf: merges Pais podem fazer checkout dos filhos, Staff pode gerenciar checkins kids';
-- merges: Staff pode gerenciar checkins kids
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."kids_checkins" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."kids_checkins" IS 'perf: merges Staff pode gerenciar checkins kids';

-- ==================== liturgia_recursos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar recursos liturgia" ON "public"."liturgia_recursos";
DROP POLICY IF EXISTS "Todos podem ver recursos liturgia" ON "public"."liturgia_recursos";
-- merges: Admins podem gerenciar recursos liturgia, Todos podem ver recursos liturgia
CREATE POLICY "perf_merge_000_select_pub" ON "public"."liturgia_recursos" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."liturgia_recursos" IS 'perf: merges Admins podem gerenciar recursos liturgia, Todos podem ver recursos liturgia';
-- merges: Admins podem gerenciar recursos liturgia
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."liturgia_recursos" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."liturgia_recursos" IS 'perf: merges Admins podem gerenciar recursos liturgia';
-- merges: Admins podem gerenciar recursos liturgia
CREATE POLICY "perf_merge_002_update_pub" ON "public"."liturgia_recursos" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."liturgia_recursos" IS 'perf: merges Admins podem gerenciar recursos liturgia';
-- merges: Admins podem gerenciar recursos liturgia
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."liturgia_recursos" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."liturgia_recursos" IS 'perf: merges Admins podem gerenciar recursos liturgia';

-- ==================== liturgia_templates ====================
DROP POLICY IF EXISTS "Admins podem gerenciar templates liturgia" ON "public"."liturgia_templates";
DROP POLICY IF EXISTS "Todos podem ver templates liturgia" ON "public"."liturgia_templates";
-- merges: Admins podem gerenciar templates liturgia, Todos podem ver templates liturgia
CREATE POLICY "perf_merge_000_select_pub" ON "public"."liturgia_templates" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."liturgia_templates" IS 'perf: merges Admins podem gerenciar templates liturgia, Todos podem ver templates liturgia';
-- merges: Admins podem gerenciar templates liturgia
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."liturgia_templates" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."liturgia_templates" IS 'perf: merges Admins podem gerenciar templates liturgia';
-- merges: Admins podem gerenciar templates liturgia
CREATE POLICY "perf_merge_002_update_pub" ON "public"."liturgia_templates" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."liturgia_templates" IS 'perf: merges Admins podem gerenciar templates liturgia';
-- merges: Admins podem gerenciar templates liturgia
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."liturgia_templates" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."liturgia_templates" IS 'perf: merges Admins podem gerenciar templates liturgia';

-- ==================== liturgias ====================
DROP POLICY IF EXISTS "Admins podem gerenciar liturgias" ON "public"."liturgias";
DROP POLICY IF EXISTS "Todos podem ver liturgias" ON "public"."liturgias";
-- merges: Admins podem gerenciar liturgias, Todos podem ver liturgias
CREATE POLICY "perf_merge_000_select_pub" ON "public"."liturgias" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."liturgias" IS 'perf: merges Admins podem gerenciar liturgias, Todos podem ver liturgias';
-- merges: Admins podem gerenciar liturgias
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."liturgias" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."liturgias" IS 'perf: merges Admins podem gerenciar liturgias';
-- merges: Admins podem gerenciar liturgias
CREATE POLICY "perf_merge_002_update_pub" ON "public"."liturgias" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."liturgias" IS 'perf: merges Admins podem gerenciar liturgias';
-- merges: Admins podem gerenciar liturgias
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."liturgias" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."liturgias" IS 'perf: merges Admins podem gerenciar liturgias';

-- ==================== membro_funcoes ====================
DROP POLICY IF EXISTS "Admins podem gerenciar funcoes membros" ON "public"."membro_funcoes";
DROP POLICY IF EXISTS "Membros podem ver funcoes" ON "public"."membro_funcoes";
-- merges: Admins podem gerenciar funcoes membros, Membros podem ver funcoes
CREATE POLICY "perf_merge_000_select_pub" ON "public"."membro_funcoes" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."membro_funcoes" IS 'perf: merges Admins podem gerenciar funcoes membros, Membros podem ver funcoes';
-- merges: Admins podem gerenciar funcoes membros
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."membro_funcoes" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."membro_funcoes" IS 'perf: merges Admins podem gerenciar funcoes membros';
-- merges: Admins podem gerenciar funcoes membros
CREATE POLICY "perf_merge_002_update_pub" ON "public"."membro_funcoes" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."membro_funcoes" IS 'perf: merges Admins podem gerenciar funcoes membros';
-- merges: Admins podem gerenciar funcoes membros
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."membro_funcoes" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."membro_funcoes" IS 'perf: merges Admins podem gerenciar funcoes membros';

-- ==================== membros_time ====================
DROP POLICY IF EXISTS "Admin gerencia todos membros de times" ON "public"."membros_time";
DROP POLICY IF EXISTS "Lider gerencia membros do seu time" ON "public"."membros_time";
-- merges: Admin gerencia todos membros de times, Lider gerencia membros do seu time
CREATE POLICY "perf_merge_000_select_auth" ON "public"."membros_time" FOR SELECT TO "authenticated" USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."is_time_leader"((select "auth"."uid"()), "time_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."membros_time" IS 'perf: merges Admin gerencia todos membros de times, Lider gerencia membros do seu time';
-- merges: Admin gerencia todos membros de times, Lider gerencia membros do seu time
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."membros_time" FOR INSERT TO "authenticated" WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."is_time_leader"((select "auth"."uid"()), "time_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."membros_time" IS 'perf: merges Admin gerencia todos membros de times, Lider gerencia membros do seu time';
-- merges: Admin gerencia todos membros de times, Lider gerencia membros do seu time
CREATE POLICY "perf_merge_002_update_auth" ON "public"."membros_time" FOR UPDATE TO "authenticated" USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."is_time_leader"((select "auth"."uid"()), "time_id") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."is_time_leader"((select "auth"."uid"()), "time_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."membros_time" IS 'perf: merges Admin gerencia todos membros de times, Lider gerencia membros do seu time';
-- merges: Admin gerencia todos membros de times, Lider gerencia membros do seu time
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."membros_time" FOR DELETE TO "authenticated" USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."is_time_leader"((select "auth"."uid"()), "time_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."membros_time" IS 'perf: merges Admin gerencia todos membros de times, Lider gerencia membros do seu time';

-- ==================== midia_tags ====================
DROP POLICY IF EXISTS "Admins podem gerenciar midia_tags" ON "public"."midia_tags";
DROP POLICY IF EXISTS "Admins podem gerenciar relação mídia-tags" ON "public"."midia_tags";
DROP POLICY IF EXISTS "Todos podem ver midia_tags" ON "public"."midia_tags";
DROP POLICY IF EXISTS "Todos podem ver relações mídia-tags" ON "public"."midia_tags";
-- merges: Admins podem gerenciar midia_tags, Admins podem gerenciar relação mídia-tags, Todos podem ver midia_tags, Todos podem ver relações mídia-tags
CREATE POLICY "perf_merge_000_select_pub" ON "public"."midia_tags" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ("public"."has_filial_access"("igreja_id", "filial_id")) OR (true));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."midia_tags" IS 'perf: merges Admins podem gerenciar midia_tags, Admins podem gerenciar relação mídia-tags, Todos podem ver midia_tags, Todos podem ver relações mídia-tags';
-- merges: Admins podem gerenciar midia_tags, Admins podem gerenciar relação mídia-tags
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."midia_tags" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."midia_tags" IS 'perf: merges Admins podem gerenciar midia_tags, Admins podem gerenciar relação mídia-tags';
-- merges: Admins podem gerenciar midia_tags, Admins podem gerenciar relação mídia-tags
CREATE POLICY "perf_merge_002_update_pub" ON "public"."midia_tags" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."midia_tags" IS 'perf: merges Admins podem gerenciar midia_tags, Admins podem gerenciar relação mídia-tags';
-- merges: Admins podem gerenciar midia_tags, Admins podem gerenciar relação mídia-tags
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."midia_tags" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."midia_tags" IS 'perf: merges Admins podem gerenciar midia_tags, Admins podem gerenciar relação mídia-tags';

-- ==================== midias ====================
DROP POLICY IF EXISTS "Admins podem gerenciar midias" ON "public"."midias";
DROP POLICY IF EXISTS "Admins podem gerenciar mídias" ON "public"."midias";
DROP POLICY IF EXISTS "Membros podem ver mídias" ON "public"."midias";
DROP POLICY IF EXISTS "Todos podem ver midias ativas" ON "public"."midias";
-- merges: Admins podem gerenciar midias, Admins podem gerenciar mídias, Membros podem ver mídias, Todos podem ver midias ativas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."midias" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (true) OR (((("ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."midias" IS 'perf: merges Admins podem gerenciar midias, Admins podem gerenciar mídias, Membros podem ver mídias, Todos podem ver midias ativas';
-- merges: Admins podem gerenciar midias, Admins podem gerenciar mídias
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."midias" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."midias" IS 'perf: merges Admins podem gerenciar midias, Admins podem gerenciar mídias';
-- merges: Admins podem gerenciar midias, Admins podem gerenciar mídias
CREATE POLICY "perf_merge_002_update_pub" ON "public"."midias" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."midias" IS 'perf: merges Admins podem gerenciar midias, Admins podem gerenciar mídias';
-- merges: Admins podem gerenciar midias, Admins podem gerenciar mídias
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."midias" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."midias" IS 'perf: merges Admins podem gerenciar midias, Admins podem gerenciar mídias';

-- ==================== module_permissions ====================
DROP POLICY IF EXISTS "Admins podem gerenciar permissões" ON "public"."module_permissions";
DROP POLICY IF EXISTS "Todos podem ver permissões de módulos" ON "public"."module_permissions";
-- merges: Admins podem gerenciar permissões, Todos podem ver permissões de módulos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."module_permissions" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (true));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."module_permissions" IS 'perf: merges Admins podem gerenciar permissões, Todos podem ver permissões de módulos';
-- merges: Admins podem gerenciar permissões
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."module_permissions" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."module_permissions" IS 'perf: merges Admins podem gerenciar permissões';
-- merges: Admins podem gerenciar permissões
CREATE POLICY "perf_merge_002_update_pub" ON "public"."module_permissions" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."module_permissions" IS 'perf: merges Admins podem gerenciar permissões';
-- merges: Admins podem gerenciar permissões
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."module_permissions" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."module_permissions" IS 'perf: merges Admins podem gerenciar permissões';

-- ==================== notifications ====================
DROP POLICY IF EXISTS "Usuarios podem atualizar proprias notificacoes" ON "public"."notifications";
DROP POLICY IF EXISTS "Usuarios podem ver proprias notificacoes" ON "public"."notifications";
DROP POLICY IF EXISTS "Usuários marcam leitura de suas notificações" ON "public"."notifications";
DROP POLICY IF EXISTS "Usuários podem atualizar suas notificações" ON "public"."notifications";
DROP POLICY IF EXISTS "Usuários podem ver suas notificações" ON "public"."notifications";
DROP POLICY IF EXISTS "Usuários veem suas próprias notificações" ON "public"."notifications";
-- merges: Usuarios podem ver proprias notificacoes, Usuários podem ver suas notificações, Usuários veem suas próprias notificações
CREATE POLICY "perf_merge_000_select_pub" ON "public"."notifications" FOR SELECT USING (((("user_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((select "auth"."uid"()) = "user_id")) OR (((select "auth"."uid"()) = "user_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."notifications" IS 'perf: merges Usuarios podem ver proprias notificacoes, Usuários podem ver suas notificações, Usuários veem suas próprias notificações';
-- merges: Usuarios podem atualizar proprias notificacoes, Usuários marcam leitura de suas notificações, Usuários podem atualizar suas notificações
CREATE POLICY "perf_merge_001_update_pub" ON "public"."notifications" FOR UPDATE USING (((("user_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((select "auth"."uid"()) = "user_id")) OR (((select "auth"."uid"()) = "user_id"))) WITH CHECK (((("user_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((select "auth"."uid"()) = "user_id")) OR (((select "auth"."uid"()) = "user_id")));
COMMENT ON POLICY "perf_merge_001_update_pub" ON "public"."notifications" IS 'perf: merges Usuarios podem atualizar proprias notificacoes, Usuários marcam leitura de suas notificações, Usuários podem atualizar suas notificações';

-- ==================== onboarding_requests ====================
DROP POLICY IF EXISTS "Qualquer um pode criar solicitacao" ON "public"."onboarding_requests";
DROP POLICY IF EXISTS "Super admin gerencia onboarding" ON "public"."onboarding_requests";
DROP POLICY IF EXISTS "Usuario pode ver sua solicitacao" ON "public"."onboarding_requests";
-- merges: Super admin gerencia onboarding, Usuario pode ver sua solicitacao
CREATE POLICY "perf_merge_000_select_pub" ON "public"."onboarding_requests" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")) OR (("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = (select "auth"."uid"()))))::"text")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."onboarding_requests" IS 'perf: merges Super admin gerencia onboarding, Usuario pode ver sua solicitacao';
-- merges: Qualquer um pode criar solicitacao, Super admin gerencia onboarding
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."onboarding_requests" FOR INSERT WITH CHECK ((true) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."onboarding_requests" IS 'perf: merges Qualquer um pode criar solicitacao, Super admin gerencia onboarding';
-- merges: Super admin gerencia onboarding
CREATE POLICY "perf_merge_002_update_pub" ON "public"."onboarding_requests" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."onboarding_requests" IS 'perf: merges Super admin gerencia onboarding';
-- merges: Super admin gerencia onboarding
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."onboarding_requests" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."onboarding_requests" IS 'perf: merges Super admin gerencia onboarding';

-- ==================== otp_verificacao ====================
DROP POLICY IF EXISTS "OTP read denied for clients" ON "public"."otp_verificacao";
DROP POLICY IF EXISTS "OTP write denied for clients" ON "public"."otp_verificacao";
-- merges: OTP read denied for clients, OTP write denied for clients
CREATE POLICY "perf_merge_000_select_anon_auth" ON "public"."otp_verificacao" FOR SELECT TO "anon", "authenticated" USING ((false) OR (false));
COMMENT ON POLICY "perf_merge_000_select_anon_auth" ON "public"."otp_verificacao" IS 'perf: merges OTP read denied for clients, OTP write denied for clients';
-- merges: OTP write denied for clients
CREATE POLICY "perf_merge_001_insert_anon_auth" ON "public"."otp_verificacao" FOR INSERT TO "anon", "authenticated" WITH CHECK ((false));
COMMENT ON POLICY "perf_merge_001_insert_anon_auth" ON "public"."otp_verificacao" IS 'perf: merges OTP write denied for clients';
-- merges: OTP write denied for clients
CREATE POLICY "perf_merge_002_update_anon_auth" ON "public"."otp_verificacao" FOR UPDATE TO "anon", "authenticated" USING ((false)) WITH CHECK ((false));
COMMENT ON POLICY "perf_merge_002_update_anon_auth" ON "public"."otp_verificacao" IS 'perf: merges OTP write denied for clients';
-- merges: OTP write denied for clients
CREATE POLICY "perf_merge_003_delete_anon_auth" ON "public"."otp_verificacao" FOR DELETE TO "anon", "authenticated" USING ((false));
COMMENT ON POLICY "perf_merge_003_delete_anon_auth" ON "public"."otp_verificacao" IS 'perf: merges OTP write denied for clients';

-- ==================== pedidos_oracao ====================
DROP POLICY IF EXISTS "admin_pastor_select_todos" ON "public"."pedidos_oracao";
DROP POLICY IF EXISTS "admin_pastor_update_todos" ON "public"."pedidos_oracao";
DROP POLICY IF EXISTS "intercessor_select_designados_nao_confidenciais" ON "public"."pedidos_oracao";
DROP POLICY IF EXISTS "intercessor_update_designados" ON "public"."pedidos_oracao";
-- merges: admin_pastor_select_todos, intercessor_select_designados_nao_confidenciais
CREATE POLICY "perf_merge_000_select_auth" ON "public"."pedidos_oracao" FOR SELECT TO "authenticated" USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("confidencial" = false) AND ("intercessor_id" IN ( SELECT "intercessores"."id"
   FROM "public"."intercessores"
  WHERE (("intercessores"."user_id" = (select "auth"."uid"())) AND ("intercessores"."ativo" = true)))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."pedidos_oracao" IS 'perf: merges admin_pastor_select_todos, intercessor_select_designados_nao_confidenciais';
-- merges: admin_pastor_update_todos, intercessor_update_designados
CREATE POLICY "perf_merge_001_update_auth" ON "public"."pedidos_oracao" FOR UPDATE TO "authenticated" USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("intercessor_id" IN ( SELECT "intercessores"."id"
   FROM "public"."intercessores"
  WHERE (("intercessores"."user_id" = (select "auth"."uid"())) AND ("intercessores"."ativo" = true)))) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("intercessor_id" IN ( SELECT "intercessores"."id"
   FROM "public"."intercessores"
  WHERE (("intercessores"."user_id" = (select "auth"."uid"())) AND ("intercessores"."ativo" = true)))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_update_auth" ON "public"."pedidos_oracao" IS 'perf: merges admin_pastor_update_todos, intercessor_update_designados';

-- ==================== presencas_aula ====================
DROP POLICY IF EXISTS "Admins podem gerenciar presencas" ON "public"."presencas_aula";
DROP POLICY IF EXISTS "Alunos podem ver proprias presencas" ON "public"."presencas_aula";
-- merges: Admins podem gerenciar presencas, Alunos podem ver proprias presencas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."presencas_aula" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("aluno_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."presencas_aula" IS 'perf: merges Admins podem gerenciar presencas, Alunos podem ver proprias presencas';
-- merges: Admins podem gerenciar presencas
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."presencas_aula" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."presencas_aula" IS 'perf: merges Admins podem gerenciar presencas';
-- merges: Admins podem gerenciar presencas
CREATE POLICY "perf_merge_002_update_pub" ON "public"."presencas_aula" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."presencas_aula" IS 'perf: merges Admins podem gerenciar presencas';
-- merges: Admins podem gerenciar presencas
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."presencas_aula" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."presencas_aula" IS 'perf: merges Admins podem gerenciar presencas';

-- ==================== profile_contatos ====================
DROP POLICY IF EXISTS "Admins can manage all contacts" ON "public"."profile_contatos";
DROP POLICY IF EXISTS "Church staff can view contacts in same filial" ON "public"."profile_contatos";
DROP POLICY IF EXISTS "Users can delete their own contacts" ON "public"."profile_contatos";
DROP POLICY IF EXISTS "Users can manage their own contacts" ON "public"."profile_contatos";
DROP POLICY IF EXISTS "Users can update their own contacts" ON "public"."profile_contatos";
DROP POLICY IF EXISTS "Users can view their own contacts" ON "public"."profile_contatos";
-- merges: Admins can manage all contacts, Church staff can view contacts in same filial, Users can view their own contacts
CREATE POLICY "perf_merge_000_select_pub" ON "public"."profile_contatos" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = (select "auth"."uid"())) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'professor'::"public"."app_role")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_contatos"."profile_id") AND "public"."has_filial_access"("profiles"."igreja_id", "profiles"."filial_id")))))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_contatos"."profile_id") AND ("profiles"."user_id" = (select "auth"."uid"())))))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."profile_contatos" IS 'perf: merges Admins can manage all contacts, Church staff can view contacts in same filial, Users can view their own contacts';
-- merges: Admins can manage all contacts, Users can manage their own contacts
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."profile_contatos" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = (select "auth"."uid"())) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_contatos"."profile_id") AND ("profiles"."user_id" = (select "auth"."uid"())))))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."profile_contatos" IS 'perf: merges Admins can manage all contacts, Users can manage their own contacts';
-- merges: Admins can manage all contacts, Users can update their own contacts
CREATE POLICY "perf_merge_002_update_pub" ON "public"."profile_contatos" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = (select "auth"."uid"())) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_contatos"."profile_id") AND ("profiles"."user_id" = (select "auth"."uid"()))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = (select "auth"."uid"())) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_contatos"."profile_id") AND ("profiles"."user_id" = (select "auth"."uid"())))))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."profile_contatos" IS 'perf: merges Admins can manage all contacts, Users can update their own contacts';
-- merges: Admins can manage all contacts, Users can delete their own contacts
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."profile_contatos" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = (select "auth"."uid"())) AND ("user_roles"."role" = 'admin'::"public"."app_role"))))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "profile_contatos"."profile_id") AND ("profiles"."user_id" = (select "auth"."uid"())))))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."profile_contatos" IS 'perf: merges Admins can manage all contacts, Users can delete their own contacts';

-- ==================== profiles ====================
DROP POLICY IF EXISTS "admins_can_create_profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "admins_can_update_any_profile" ON "public"."profiles";
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "members_can_create_dependents" ON "public"."profiles";
DROP POLICY IF EXISTS "members_can_create_family_profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "members_can_update_dependents" ON "public"."profiles";
DROP POLICY IF EXISTS "members_can_view_family_members" ON "public"."profiles";
DROP POLICY IF EXISTS "users_can_create_own_profile" ON "public"."profiles";
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON "public"."profiles";
DROP POLICY IF EXISTS "users_can_update_own_profile" ON "public"."profiles";
DROP POLICY IF EXISTS "users_can_view_own_profile" ON "public"."profiles";
-- merges: admins_can_create_profiles, admins_can_update_any_profile, admins_can_view_all_profiles, members_can_view_family_members, users_can_update_own_profile, users_can_view_own_profile
CREATE POLICY "perf_merge_000_select_pub" ON "public"."profiles" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND (("user_id" = (select "auth"."uid"())) OR (("familia_id" IS NOT NULL) AND ("familia_id" = "public"."get_user_familia_id"((select "auth"."uid"()))))))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."profiles" IS 'perf: merges admins_can_create_profiles, admins_can_update_any_profile, admins_can_view_all_profiles, members_can_view_family_members, users_can_update_own_profile, users_can_view_own_profile';
-- merges: admins_can_create_profiles, admins_can_update_any_profile, admins_can_view_all_profiles, members_can_create_dependents, users_can_create_own_profile, users_can_update_own_profile, users_can_view_own_profile
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."profiles" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("user_id" IS NULL) AND ("familia_id" IS NOT NULL) AND ("familia_id" = "public"."get_user_familia_id"((select "auth"."uid"()))))) OR ((((select "auth"."uid"()) = "user_id") AND ((select "auth"."uid"()) IS NOT NULL) AND ("user_id" IS NOT NULL))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."profiles" IS 'perf: merges admins_can_create_profiles, admins_can_update_any_profile, admins_can_view_all_profiles, members_can_create_dependents, users_can_create_own_profile, users_can_update_own_profile, users_can_view_own_profile';
-- merges: members_can_create_family_profiles, users_can_insert_own_profile
CREATE POLICY "perf_merge_002_insert_auth" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (((("user_id" IS NULL) OR ("user_id" = (select "auth"."uid"())))) OR (((select "auth"."uid"()) = "user_id")));
COMMENT ON POLICY "perf_merge_002_insert_auth" ON "public"."profiles" IS 'perf: merges members_can_create_family_profiles, users_can_insert_own_profile';
-- merges: admins_can_create_profiles, admins_can_update_any_profile, admins_can_view_all_profiles, members_can_update_dependents, users_can_update_own_profile, users_can_view_own_profile
CREATE POLICY "perf_merge_003_update_pub" ON "public"."profiles" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("user_id" IS NULL) AND ("familia_id" IS NOT NULL) AND ("familia_id" = "public"."get_user_familia_id"((select "auth"."uid"()))))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("user_id" IS NULL) AND ("familia_id" IS NOT NULL) AND ("familia_id" = "public"."get_user_familia_id"((select "auth"."uid"()))))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_update_pub" ON "public"."profiles" IS 'perf: merges admins_can_create_profiles, admins_can_update_any_profile, admins_can_view_all_profiles, members_can_update_dependents, users_can_update_own_profile, users_can_view_own_profile';
-- merges: admins_can_create_profiles, admins_can_update_any_profile, admins_can_view_all_profiles, users_can_update_own_profile, users_can_view_own_profile
CREATE POLICY "perf_merge_004_delete_pub" ON "public"."profiles" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_004_delete_pub" ON "public"."profiles" IS 'perf: merges admins_can_create_profiles, admins_can_update_any_profile, admins_can_view_all_profiles, users_can_update_own_profile, users_can_view_own_profile';

-- ==================== projetos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar projetos" ON "public"."projetos";
DROP POLICY IF EXISTS "Membros podem ver projetos" ON "public"."projetos";
DROP POLICY IF EXISTS "Membros veem projetos onde sao responsaveis" ON "public"."projetos";
-- merges: Admins podem gerenciar projetos, Membros podem ver projetos, Membros veem projetos onde sao responsaveis
CREATE POLICY "perf_merge_000_select_pub" ON "public"."projetos" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")) OR (("lider_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."projetos" IS 'perf: merges Admins podem gerenciar projetos, Membros podem ver projetos, Membros veem projetos onde sao responsaveis';
-- merges: Admins podem gerenciar projetos
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."projetos" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."projetos" IS 'perf: merges Admins podem gerenciar projetos';
-- merges: Admins podem gerenciar projetos
CREATE POLICY "perf_merge_002_update_pub" ON "public"."projetos" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."projetos" IS 'perf: merges Admins podem gerenciar projetos';
-- merges: Admins podem gerenciar projetos
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."projetos" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."projetos" IS 'perf: merges Admins podem gerenciar projetos';

-- ==================== respostas_quiz ====================
DROP POLICY IF EXISTS "Admin gerencia respostas" ON "public"."respostas_quiz";
DROP POLICY IF EXISTS "Aluno insere respostas" ON "public"."respostas_quiz";
DROP POLICY IF EXISTS "Aluno vê suas respostas" ON "public"."respostas_quiz";
-- merges: Admin gerencia respostas, Aluno vê suas respostas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."respostas_quiz" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (((select "auth"."uid"()) IN ( SELECT "p"."user_id"
   FROM ("public"."inscricoes_jornada" "ij"
     JOIN "public"."profiles" "p" ON (("ij"."pessoa_id" = "p"."id")))
  WHERE ("ij"."id" = "respostas_quiz"."inscricao_id")))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."respostas_quiz" IS 'perf: merges Admin gerencia respostas, Aluno vê suas respostas';
-- merges: Admin gerencia respostas, Aluno insere respostas
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."respostas_quiz" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (((select "auth"."uid"()) IN ( SELECT "p"."user_id"
   FROM ("public"."inscricoes_jornada" "ij"
     JOIN "public"."profiles" "p" ON (("ij"."pessoa_id" = "p"."id")))
  WHERE ("ij"."id" = "respostas_quiz"."inscricao_id")))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."respostas_quiz" IS 'perf: merges Admin gerencia respostas, Aluno insere respostas';
-- merges: Admin gerencia respostas
CREATE POLICY "perf_merge_002_update_pub" ON "public"."respostas_quiz" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."respostas_quiz" IS 'perf: merges Admin gerencia respostas';
-- merges: Admin gerencia respostas
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."respostas_quiz" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."respostas_quiz" IS 'perf: merges Admin gerencia respostas';

-- ==================== resultados_teste ====================
DROP POLICY IF EXISTS "Admin e lider gerenciam resultados" ON "public"."resultados_teste";
DROP POLICY IF EXISTS "Candidatos e mentores veem resultados" ON "public"."resultados_teste";
-- merges: Admin e lider gerenciam resultados, Candidatos e mentores veem resultados
CREATE POLICY "perf_merge_000_select_pub" ON "public"."resultados_teste" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))) OR ((("candidato_id" IN ( SELECT "candidatos_voluntario"."id"
   FROM "public"."candidatos_voluntario"
  WHERE ("candidatos_voluntario"."pessoa_id" = ( SELECT "profiles"."id"
           FROM "public"."profiles"
          WHERE ("profiles"."user_id" = (select "auth"."uid"())))))) OR (EXISTS ( SELECT 1
   FROM "public"."integracao_voluntario"
  WHERE (("integracao_voluntario"."id" = "resultados_teste"."integracao_id") AND ("integracao_voluntario"."mentor_id" = ( SELECT "profiles"."id"
           FROM "public"."profiles"
          WHERE ("profiles"."user_id" = (select "auth"."uid"()))))))) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."resultados_teste" IS 'perf: merges Admin e lider gerenciam resultados, Candidatos e mentores veem resultados';
-- merges: Admin e lider gerenciam resultados
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."resultados_teste" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."resultados_teste" IS 'perf: merges Admin e lider gerenciam resultados';
-- merges: Admin e lider gerenciam resultados
CREATE POLICY "perf_merge_002_update_pub" ON "public"."resultados_teste" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."resultados_teste" IS 'perf: merges Admin e lider gerenciam resultados';
-- merges: Admin e lider gerenciam resultados
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."resultados_teste" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."resultados_teste" IS 'perf: merges Admin e lider gerenciam resultados';

-- ==================== role_permissions ====================
DROP POLICY IF EXISTS "Admins podem gerenciar role_permissions" ON "public"."role_permissions";
DROP POLICY IF EXISTS "Todos podem ver role_permissions" ON "public"."role_permissions";
-- merges: Admins podem gerenciar role_permissions, Todos podem ver role_permissions
CREATE POLICY "perf_merge_000_select_pub" ON "public"."role_permissions" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (true));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."role_permissions" IS 'perf: merges Admins podem gerenciar role_permissions, Todos podem ver role_permissions';
-- merges: Admins podem gerenciar role_permissions
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."role_permissions" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."role_permissions" IS 'perf: merges Admins podem gerenciar role_permissions';
-- merges: Admins podem gerenciar role_permissions
CREATE POLICY "perf_merge_002_update_pub" ON "public"."role_permissions" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."role_permissions" IS 'perf: merges Admins podem gerenciar role_permissions';
-- merges: Admins podem gerenciar role_permissions
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."role_permissions" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."role_permissions" IS 'perf: merges Admins podem gerenciar role_permissions';

-- ==================== salas ====================
DROP POLICY IF EXISTS "Admins podem gerenciar salas" ON "public"."salas";
DROP POLICY IF EXISTS "Todos podem ver salas ativas" ON "public"."salas";
-- merges: Admins podem gerenciar salas, Todos podem ver salas ativas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."salas" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((("ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."salas" IS 'perf: merges Admins podem gerenciar salas, Todos podem ver salas ativas';
-- merges: Admins podem gerenciar salas
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."salas" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."salas" IS 'perf: merges Admins podem gerenciar salas';
-- merges: Admins podem gerenciar salas
CREATE POLICY "perf_merge_002_update_pub" ON "public"."salas" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."salas" IS 'perf: merges Admins podem gerenciar salas';
-- merges: Admins podem gerenciar salas
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."salas" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."salas" IS 'perf: merges Admins podem gerenciar salas';

-- ==================== sentimentos_membros ====================
DROP POLICY IF EXISTS "Admins e pastores podem ver sentimentos" ON "public"."sentimentos_membros";
DROP POLICY IF EXISTS "Membros podem ver seus próprios sentimentos" ON "public"."sentimentos_membros";
DROP POLICY IF EXISTS "Usuarios podem ver proprios sentimentos" ON "public"."sentimentos_membros";
-- merges: Admins e pastores podem ver sentimentos, Membros podem ver seus próprios sentimentos, Usuarios podem ver proprios sentimentos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."sentimentos_membros" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))) OR ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."sentimentos_membros" IS 'perf: merges Admins e pastores podem ver sentimentos, Membros podem ver seus próprios sentimentos, Usuarios podem ver proprios sentimentos';

-- ==================== sessoes_itens_draft ====================
DROP POLICY IF EXISTS "itens_draft_manage_finance_roles" ON "public"."sessoes_itens_draft";
DROP POLICY IF EXISTS "itens_draft_select_same_scope" ON "public"."sessoes_itens_draft";
-- merges: itens_draft_manage_finance_roles, itens_draft_select_same_scope
CREATE POLICY "perf_merge_000_select_pub" ON "public"."sessoes_itens_draft" FOR SELECT USING ((((EXISTS ( SELECT 1
   FROM "public"."sessoes_contagem" "s"
  WHERE (("s"."id" = "sessoes_itens_draft"."sessao_id") AND "public"."has_filial_access"("s"."igreja_id", "s"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."sessoes_contagem" "s"
  WHERE (("s"."id" = "sessoes_itens_draft"."sessao_id") AND "public"."has_filial_access"("s"."igreja_id", "s"."filial_id"))))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."sessoes_itens_draft" IS 'perf: merges itens_draft_manage_finance_roles, itens_draft_select_same_scope';
-- merges: itens_draft_manage_finance_roles
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."sessoes_itens_draft" FOR INSERT WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."sessoes_contagem" "s"
  WHERE (("s"."id" = "sessoes_itens_draft"."sessao_id") AND "public"."has_filial_access"("s"."igreja_id", "s"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."sessoes_itens_draft" IS 'perf: merges itens_draft_manage_finance_roles';
-- merges: itens_draft_manage_finance_roles
CREATE POLICY "perf_merge_002_update_pub" ON "public"."sessoes_itens_draft" FOR UPDATE USING ((((EXISTS ( SELECT 1
   FROM "public"."sessoes_contagem" "s"
  WHERE (("s"."id" = "sessoes_itens_draft"."sessao_id") AND "public"."has_filial_access"("s"."igreja_id", "s"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role"))))) WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."sessoes_contagem" "s"
  WHERE (("s"."id" = "sessoes_itens_draft"."sessao_id") AND "public"."has_filial_access"("s"."igreja_id", "s"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."sessoes_itens_draft" IS 'perf: merges itens_draft_manage_finance_roles';
-- merges: itens_draft_manage_finance_roles
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."sessoes_itens_draft" FOR DELETE USING ((((EXISTS ( SELECT 1
   FROM "public"."sessoes_contagem" "s"
  WHERE (("s"."id" = "sessoes_itens_draft"."sessao_id") AND "public"."has_filial_access"("s"."igreja_id", "s"."filial_id")))) AND ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."sessoes_itens_draft" IS 'perf: merges itens_draft_manage_finance_roles';

-- ==================== solicitacoes_reembolso ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar reembolsos" ON "public"."solicitacoes_reembolso";
DROP POLICY IF EXISTS "Usuarios podem criar proprios reembolsos" ON "public"."solicitacoes_reembolso";
DROP POLICY IF EXISTS "Usuarios podem ver proprios reembolsos" ON "public"."solicitacoes_reembolso";
DROP POLICY IF EXISTS "Usuários podem editar suas solicitações" ON "public"."solicitacoes_reembolso";
-- merges: Admins e tesoureiros podem gerenciar reembolsos, Usuarios podem ver proprios reembolsos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."solicitacoes_reembolso" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("solicitante_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."solicitacoes_reembolso" IS 'perf: merges Admins e tesoureiros podem gerenciar reembolsos, Usuarios podem ver proprios reembolsos';
-- merges: Admins e tesoureiros podem gerenciar reembolsos, Usuarios podem criar proprios reembolsos
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."solicitacoes_reembolso" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("solicitante_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."solicitacoes_reembolso" IS 'perf: merges Admins e tesoureiros podem gerenciar reembolsos, Usuarios podem criar proprios reembolsos';
-- merges: Admins e tesoureiros podem gerenciar reembolsos, Usuários podem editar suas solicitações
CREATE POLICY "perf_merge_002_update_pub" ON "public"."solicitacoes_reembolso" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("solicitante_id" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))
 LIMIT 1)))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("solicitante_id" = ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))
 LIMIT 1))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."solicitacoes_reembolso" IS 'perf: merges Admins e tesoureiros podem gerenciar reembolsos, Usuários podem editar suas solicitações';
-- merges: Admins e tesoureiros podem gerenciar reembolsos
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."solicitacoes_reembolso" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."solicitacoes_reembolso" IS 'perf: merges Admins e tesoureiros podem gerenciar reembolsos';

-- ==================== subcategorias_financeiras ====================
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar subcategorias" ON "public"."subcategorias_financeiras";
DROP POLICY IF EXISTS "Usuarios autenticados podem ver subcategorias ativas" ON "public"."subcategorias_financeiras";
-- merges: Admins e tesoureiros podem gerenciar subcategorias, Usuarios autenticados podem ver subcategorias ativas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."subcategorias_financeiras" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((((select "auth"."uid"()) IS NOT NULL) AND ("ativo" = true))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."subcategorias_financeiras" IS 'perf: merges Admins e tesoureiros podem gerenciar subcategorias, Usuarios autenticados podem ver subcategorias ativas';
-- merges: Admins e tesoureiros podem gerenciar subcategorias
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."subcategorias_financeiras" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."subcategorias_financeiras" IS 'perf: merges Admins e tesoureiros podem gerenciar subcategorias';
-- merges: Admins e tesoureiros podem gerenciar subcategorias
CREATE POLICY "perf_merge_002_update_pub" ON "public"."subcategorias_financeiras" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."subcategorias_financeiras" IS 'perf: merges Admins e tesoureiros podem gerenciar subcategorias';
-- merges: Admins e tesoureiros podem gerenciar subcategorias
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."subcategorias_financeiras" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."subcategorias_financeiras" IS 'perf: merges Admins e tesoureiros podem gerenciar subcategorias';

-- ==================== tags_midias ====================
DROP POLICY IF EXISTS "Admins podem gerenciar tags" ON "public"."tags_midias";
DROP POLICY IF EXISTS "Todos podem ver tags" ON "public"."tags_midias";
-- merges: Admins podem gerenciar tags, Todos podem ver tags
CREATE POLICY "perf_merge_000_select_pub" ON "public"."tags_midias" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ("public"."has_filial_access"("igreja_id", "filial_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."tags_midias" IS 'perf: merges Admins podem gerenciar tags, Todos podem ver tags';
-- merges: Admins podem gerenciar tags
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."tags_midias" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."tags_midias" IS 'perf: merges Admins podem gerenciar tags';
-- merges: Admins podem gerenciar tags
CREATE POLICY "perf_merge_002_update_pub" ON "public"."tags_midias" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."tags_midias" IS 'perf: merges Admins podem gerenciar tags';
-- merges: Admins podem gerenciar tags
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."tags_midias" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."tags_midias" IS 'perf: merges Admins podem gerenciar tags';

-- ==================== tarefas ====================
DROP POLICY IF EXISTS "Admins podem gerenciar tarefas" ON "public"."tarefas";
DROP POLICY IF EXISTS "Responsaveis gerenciam suas tarefas" ON "public"."tarefas";
DROP POLICY IF EXISTS "Responsaveis podem atualizar tarefas" ON "public"."tarefas";
DROP POLICY IF EXISTS "Responsaveis podem ver tarefas" ON "public"."tarefas";
DROP POLICY IF EXISTS "Secretarios visualizam tarefas" ON "public"."tarefas";
-- merges: Admins podem gerenciar tarefas, Responsaveis gerenciam suas tarefas, Responsaveis podem ver tarefas, Secretarios visualizam tarefas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."tarefas" FOR SELECT USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))) OR ((("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."tarefas" IS 'perf: merges Admins podem gerenciar tarefas, Responsaveis gerenciam suas tarefas, Responsaveis podem ver tarefas, Secretarios visualizam tarefas';
-- merges: Admins podem gerenciar tarefas, Responsaveis gerenciam suas tarefas
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."tarefas" FOR INSERT WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."tarefas" IS 'perf: merges Admins podem gerenciar tarefas, Responsaveis gerenciam suas tarefas';
-- merges: Admins podem gerenciar tarefas, Responsaveis gerenciam suas tarefas, Responsaveis podem atualizar tarefas
CREATE POLICY "perf_merge_002_update_pub" ON "public"."tarefas" FOR UPDATE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))) OR ((("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))) OR ((("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."tarefas" IS 'perf: merges Admins podem gerenciar tarefas, Responsaveis gerenciam suas tarefas, Responsaveis podem atualizar tarefas';
-- merges: Admins podem gerenciar tarefas, Responsaveis gerenciam suas tarefas
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."tarefas" FOR DELETE USING (((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("responsavel_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."tarefas" IS 'perf: merges Admins podem gerenciar tarefas, Responsaveis gerenciam suas tarefas';

-- ==================== templates_culto ====================
DROP POLICY IF EXISTS "Admins podem gerenciar templates" ON "public"."templates_culto";
DROP POLICY IF EXISTS "Membros podem ver templates ativos" ON "public"."templates_culto";
-- merges: Admins podem gerenciar templates, Membros podem ver templates ativos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."templates_culto" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (((("ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."templates_culto" IS 'perf: merges Admins podem gerenciar templates, Membros podem ver templates ativos';
-- merges: Admins podem gerenciar templates
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."templates_culto" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."templates_culto" IS 'perf: merges Admins podem gerenciar templates';
-- merges: Admins podem gerenciar templates
CREATE POLICY "perf_merge_002_update_pub" ON "public"."templates_culto" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."templates_culto" IS 'perf: merges Admins podem gerenciar templates';
-- merges: Admins podem gerenciar templates
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."templates_culto" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."templates_culto" IS 'perf: merges Admins podem gerenciar templates';

-- ==================== templates_liturgia ====================
DROP POLICY IF EXISTS "Admins podem gerenciar templates" ON "public"."templates_liturgia";
DROP POLICY IF EXISTS "Membros podem ver templates ativos" ON "public"."templates_liturgia";
-- merges: Admins podem gerenciar templates, Membros podem ver templates ativos
CREATE POLICY "perf_merge_000_select_auth" ON "public"."templates_liturgia" FOR SELECT TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ((("ativo" = true) OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_000_select_auth" ON "public"."templates_liturgia" IS 'perf: merges Admins podem gerenciar templates, Membros podem ver templates ativos';
-- merges: Admins podem gerenciar templates
CREATE POLICY "perf_merge_001_insert_auth" ON "public"."templates_liturgia" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_auth" ON "public"."templates_liturgia" IS 'perf: merges Admins podem gerenciar templates';
-- merges: Admins podem gerenciar templates
CREATE POLICY "perf_merge_002_update_auth" ON "public"."templates_liturgia" FOR UPDATE TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_auth" ON "public"."templates_liturgia" IS 'perf: merges Admins podem gerenciar templates';
-- merges: Admins podem gerenciar templates
CREATE POLICY "perf_merge_003_delete_auth" ON "public"."templates_liturgia" FOR DELETE TO "authenticated" USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_auth" ON "public"."templates_liturgia" IS 'perf: merges Admins podem gerenciar templates';

-- ==================== tenant_metricas ====================
DROP POLICY IF EXISTS "Admin igreja pode ver metricas da sua igreja" ON "public"."tenant_metricas";
DROP POLICY IF EXISTS "Super admin pode gerenciar metricas" ON "public"."tenant_metricas";
DROP POLICY IF EXISTS "Super admin pode ver todas metricas" ON "public"."tenant_metricas";
-- merges: Admin igreja pode ver metricas da sua igreja, Super admin pode gerenciar metricas, Super admin pode ver todas metricas
CREATE POLICY "perf_merge_000_select_pub" ON "public"."tenant_metricas" FOR SELECT USING ((("igreja_id" = "public"."get_current_user_igreja_id"())) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")) OR ("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."tenant_metricas" IS 'perf: merges Admin igreja pode ver metricas da sua igreja, Super admin pode gerenciar metricas, Super admin pode ver todas metricas';
-- merges: Super admin pode gerenciar metricas
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."tenant_metricas" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."tenant_metricas" IS 'perf: merges Super admin pode gerenciar metricas';
-- merges: Super admin pode gerenciar metricas
CREATE POLICY "perf_merge_002_update_pub" ON "public"."tenant_metricas" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."tenant_metricas" IS 'perf: merges Super admin pode gerenciar metricas';
-- merges: Super admin pode gerenciar metricas
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."tenant_metricas" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."tenant_metricas" IS 'perf: merges Super admin pode gerenciar metricas';

-- ==================== testemunhos ====================
DROP POLICY IF EXISTS "Admins podem gerenciar testemunhos" ON "public"."testemunhos";
DROP POLICY IF EXISTS "Autores podem atualizar seus próprios testemunhos" ON "public"."testemunhos";
DROP POLICY IF EXISTS "Autores podem ver seus próprios testemunhos" ON "public"."testemunhos";
DROP POLICY IF EXISTS "Todos podem ver testemunhos publicos" ON "public"."testemunhos";
DROP POLICY IF EXISTS "Todos podem ver testemunhos públicos publicados" ON "public"."testemunhos";
DROP POLICY IF EXISTS "Usuarios podem criar testemunhos" ON "public"."testemunhos";
-- merges: Admins podem gerenciar testemunhos, Autores podem ver seus próprios testemunhos, Todos podem ver testemunhos publicos, Todos podem ver testemunhos públicos publicados
CREATE POLICY "perf_merge_000_select_pub" ON "public"."testemunhos" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("autor_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))) OR (((("status" = 'publico'::"public"."status_testemunho") OR "public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("status" = 'publico'::"public"."status_testemunho") AND ("publicar" = true))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."testemunhos" IS 'perf: merges Admins podem gerenciar testemunhos, Autores podem ver seus próprios testemunhos, Todos podem ver testemunhos publicos, Todos podem ver testemunhos públicos publicados';
-- merges: Admins podem gerenciar testemunhos, Usuarios podem criar testemunhos
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."testemunhos" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("autor_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."testemunhos" IS 'perf: merges Admins podem gerenciar testemunhos, Usuarios podem criar testemunhos';
-- merges: Admins podem gerenciar testemunhos, Autores podem atualizar seus próprios testemunhos
CREATE POLICY "perf_merge_002_update_pub" ON "public"."testemunhos" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("autor_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"())))))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("autor_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = (select "auth"."uid"()))))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."testemunhos" IS 'perf: merges Admins podem gerenciar testemunhos, Autores podem atualizar seus próprios testemunhos';
-- merges: Admins podem gerenciar testemunhos
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."testemunhos" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."testemunhos" IS 'perf: merges Admins podem gerenciar testemunhos';

-- ==================== user_app_roles ====================
DROP POLICY IF EXISTS "Admins podem gerenciar user_app_roles" ON "public"."user_app_roles";
DROP POLICY IF EXISTS "Admins podem ver todos os roles" ON "public"."user_app_roles";
DROP POLICY IF EXISTS "Usuários podem ver seus próprios roles" ON "public"."user_app_roles";
-- merges: Admins podem gerenciar user_app_roles, Admins podem ver todos os roles, Usuários podem ver seus próprios roles
CREATE POLICY "perf_merge_000_select_pub" ON "public"."user_app_roles" FOR SELECT USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR ("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")) OR (((select "auth"."uid"()) = "user_id")));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."user_app_roles" IS 'perf: merges Admins podem gerenciar user_app_roles, Admins podem ver todos os roles, Usuários podem ver seus próprios roles';
-- merges: Admins podem gerenciar user_app_roles
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."user_app_roles" FOR INSERT WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."user_app_roles" IS 'perf: merges Admins podem gerenciar user_app_roles';
-- merges: Admins podem gerenciar user_app_roles
CREATE POLICY "perf_merge_002_update_pub" ON "public"."user_app_roles" FOR UPDATE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."user_app_roles" IS 'perf: merges Admins podem gerenciar user_app_roles';
-- merges: Admins podem gerenciar user_app_roles
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."user_app_roles" FOR DELETE USING (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role")));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."user_app_roles" IS 'perf: merges Admins podem gerenciar user_app_roles';

-- ==================== visitante_contatos ====================
DROP POLICY IF EXISTS "Admins podem atualizar contatos" ON "public"."visitante_contatos";
DROP POLICY IF EXISTS "Admins podem criar contatos" ON "public"."visitante_contatos";
DROP POLICY IF EXISTS "Admins podem deletar contatos" ON "public"."visitante_contatos";
DROP POLICY IF EXISTS "Admins podem ver todos os contatos" ON "public"."visitante_contatos";
DROP POLICY IF EXISTS "Church staff podem gerenciar contatos agendados da filial" ON "public"."visitante_contatos";
DROP POLICY IF EXISTS "Church staff podem ver contatos agendados da filial" ON "public"."visitante_contatos";
DROP POLICY IF EXISTS "Membros responsáveis podem atualizar seus contatos" ON "public"."visitante_contatos";
DROP POLICY IF EXISTS "Membros responsáveis podem ver seus contatos" ON "public"."visitante_contatos";
-- merges: Admins podem atualizar contatos, Admins podem criar contatos, Admins podem deletar contatos, Admins podem ver todos os contatos, Church staff podem ver contatos agendados da filial, Membros responsáveis podem atualizar seus contatos, Membros responsáveis podem ver seus contatos
CREATE POLICY "perf_merge_000_select_pub" ON "public"."visitante_contatos" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'professor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."visitante_contatos" IS 'perf: merges Admins podem atualizar contatos, Admins podem criar contatos, Admins podem deletar contatos, Admins podem ver todos os contatos, Church staff podem ver contatos agendados da filial, Membros responsáveis podem atualizar seus contatos, Membros responsáveis podem ver seus contatos';
-- merges: Admins podem atualizar contatos, Admins podem criar contatos, Admins podem deletar contatos, Admins podem ver todos os contatos, Membros responsáveis podem atualizar seus contatos, Membros responsáveis podem ver seus contatos
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."visitante_contatos" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."visitante_contatos" IS 'perf: merges Admins podem atualizar contatos, Admins podem criar contatos, Admins podem deletar contatos, Admins podem ver todos os contatos, Membros responsáveis podem atualizar seus contatos, Membros responsáveis podem ver seus contatos';
-- merges: Admins podem atualizar contatos, Admins podem criar contatos, Admins podem deletar contatos, Admins podem ver todos os contatos, Church staff podem gerenciar contatos agendados da filial, Membros responsáveis podem atualizar seus contatos, Membros responsáveis podem ver seus contatos
CREATE POLICY "perf_merge_002_update_pub" ON "public"."visitante_contatos" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'professor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'super_admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'admin_igreja'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'lider'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'secretario'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'tesoureiro'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'professor'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."visitante_contatos" IS 'perf: merges Admins podem atualizar contatos, Admins podem criar contatos, Admins podem deletar contatos, Admins podem ver todos os contatos, Church staff podem gerenciar contatos agendados da filial, Membros responsáveis podem atualizar seus contatos, Membros responsáveis podem ver seus contatos';
-- merges: Admins podem atualizar contatos, Admins podem criar contatos, Admins podem deletar contatos, Admins podem ver todos os contatos, Membros responsáveis podem atualizar seus contatos, Membros responsáveis podem ver seus contatos
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."visitante_contatos" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR (("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))) OR ((("membro_responsavel_id" = (select "auth"."uid"())) AND "public"."has_filial_access"("igreja_id", "filial_id"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."visitante_contatos" IS 'perf: merges Admins podem atualizar contatos, Admins podem criar contatos, Admins podem deletar contatos, Admins podem ver todos os contatos, Membros responsáveis podem atualizar seus contatos, Membros responsáveis podem ver seus contatos';

-- ==================== visitantes_leads ====================
DROP POLICY IF EXISTS "Admins podem gerenciar visitantes leads" ON "public"."visitantes_leads";
DROP POLICY IF EXISTS "Intercessores podem ver visitantes leads" ON "public"."visitantes_leads";
-- merges: Admins podem gerenciar visitantes leads, Intercessores podem ver visitantes leads
CREATE POLICY "perf_merge_000_select_pub" ON "public"."visitantes_leads" FOR SELECT USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role"))) OR ((EXISTS ( SELECT 1
   FROM "public"."intercessores"
  WHERE (("intercessores"."user_id" = (select "auth"."uid"())) AND ("intercessores"."ativo" = true))))));
COMMENT ON POLICY "perf_merge_000_select_pub" ON "public"."visitantes_leads" IS 'perf: merges Admins podem gerenciar visitantes leads, Intercessores podem ver visitantes leads';
-- merges: Admins podem gerenciar visitantes leads
CREATE POLICY "perf_merge_001_insert_pub" ON "public"."visitantes_leads" FOR INSERT WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_001_insert_pub" ON "public"."visitantes_leads" IS 'perf: merges Admins podem gerenciar visitantes leads';
-- merges: Admins podem gerenciar visitantes leads
CREATE POLICY "perf_merge_002_update_pub" ON "public"."visitantes_leads" FOR UPDATE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role")))) WITH CHECK ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_002_update_pub" ON "public"."visitantes_leads" IS 'perf: merges Admins podem gerenciar visitantes leads';
-- merges: Admins podem gerenciar visitantes leads
CREATE POLICY "perf_merge_003_delete_pub" ON "public"."visitantes_leads" FOR DELETE USING ((("public"."has_role"((select "auth"."uid"()), 'admin'::"public"."app_role") OR "public"."has_role"((select "auth"."uid"()), 'pastor'::"public"."app_role"))));
COMMENT ON POLICY "perf_merge_003_delete_pub" ON "public"."visitantes_leads" IS 'perf: merges Admins podem gerenciar visitantes leads';
