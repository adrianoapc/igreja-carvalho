-- Restaura o FOR SELECT/INSERT/UPDATE/DELETE original em 25 RLS policies
-- de 7 tabelas (profiles, eventos_convites, familias, fornecedores,
-- inscricoes_eventos, visitante_contatos, escalas) que hoje em produção
-- estão CREATE POLICY sem FOR (= FOR ALL implícito no Postgres). Também
-- adiciona 1 policy NOVA (profiles.admins_can_delete_profiles) — ver
-- nota específica junto dela mais abaixo.
--
-- Achado no review (Codex + Cursor) da PR #125 (regeneração da Fase 1/2
-- de performance), verificado policy por policy contra
-- `supabase db dump --linked` de produção: é bug PRÉ-EXISTENTE, sem
-- relação com a PR de performance (que só excluiu essas 7 tabelas da
-- Fase 1/2 por segurança, ver commit ad3d12a7 na branch
-- fix-perf-auth-rls-initplan). Ver memória
-- project-policies-for-clause-perdido-pendente pro relatório completo.
--
-- Mecanismo: no Postgres, CREATE POLICY sem FOR vira FOR ALL. Quando só
-- USING está preenchido (sem WITH CHECK), esse USING passa a valer pra
-- INSERT/UPDATE/DELETE também — uma policy nomeada "ver X"/"deletar X"
-- que era FOR SELECT/FOR DELETE virou FOR ALL, deixando quem passa no
-- filtro de leitura também escrever/apagar.
--
-- Caso mais grave: profiles."users_can_view_own_profile" foi criada
-- FOR SELECT na migration 20251130044928, que documenta explicitamente
-- "Bloquear DELETE completamente... não criar política de DELETE
-- significa que ninguém pode deletar". Hoje, sem o FOR, qualquer
-- usuário autenticado pode DELETE no próprio profiles — CONFIRMADO por
-- exploit direto num Postgres local restaurado do dump de produção
-- (SET ROLE authenticated + JWT do dono da linha; DELETE afetava 1
-- linha antes do fix, 0 depois). profiles."users_can_update_own_profile"
-- e profiles."admins_can_update_any_profile" (FOR ALL "gerenciar" mas
-- sem policy de DELETE dedicada) também permitiam o mesmo DELETE de
-- forma independente — as 3 + admins_can_view_all_profiles precisam do
-- fix pra fechar o buraco por completo.
--
-- Investigação de causa raiz: as migrations 20260103150000 e
-- 20260105120000 tocam essas mesmas policies via `ALTER POLICY ...
-- USING (...)` (pra adicionar o filtro multi-tenant) — testado
-- empiricamente num Postgres 17 solto que `ALTER POLICY` NÃO altera o
-- tipo de comando (cmd) da policy, só USING/WITH CHECK/TO, então essas
-- migrations não são a causa. Nenhuma migration no repo faz DROP+CREATE
-- dessas policies sem o FOR original. A divergência entre "migrations
-- aplicadas em ordem" e "estado real em produção" não tem commit
-- correspondente no histórico — suspeita é edição manual direta em
-- produção (dashboard do Supabase Studio ou SQL ad-hoc), nunca
-- capturada em migration. Não dá pra confirmar sem acesso a audit log
-- do dashboard; registrado aqui como hipótese mais provável, não fato.
--
-- Todas as 25 policies abaixo foram confirmadas por `git log -S` como
-- tendo o FOR explícito na migration que as criou originalmente. Fix
-- preserva o predicado ATUAL (USING/WITH CHECK/TO idênticos ao que já
-- está em produção hoje, copiados do dump) — só restaura o FOR, sem
-- mudar nenhuma lógica de autorização.
--
-- Policies com FOR ALL confirmadas INTENCIONAIS (nome "gerencia(m)",
-- sempre foram FOR ALL desde a criação) foram deixadas de fora de
-- propósito: escalas."Admin gerencia todas escalas", escalas."Lider
-- gerencia escalas do seu time", familias."admins_can_manage_families".
-- Mesma auditoria completa (ver project-policies-view-named-mas-
-- escrevem) confirmou que as demais 8 tabelas antes suspeitas
-- (cancoes_culto, posicoes_time, eventos, liturgia_culto, midias_culto,
-- times_culto, membros_time) já têm FOR SELECT explícito nas policies
-- "Membros podem ver/visualizam" — não são bug, e as "Admins podem
-- gerenciar X" delas são FOR ALL intencional (mesmo padrão), assim como
-- fornecedores.only_admins_treasurers_can_view_suppliers já é FOR
-- SELECT hoje.
--
-- Validado num Postgres 17 local restaurado do dump de produção (schema
-- completo, 0 erros ao aplicar): exploit de self-delete em profiles
-- bloqueado após o fix (DELETE 0 linhas), acesso legítimo (SELECT/
-- UPDATE do próprio perfil, escalas."Voluntario confirma propria
-- escala" continua permitindo UPDATE mas não mais DELETE) preservado.
--
-- Depois desta migration, a branch fix-perf-auth-rls-initplan pode
-- reaplicar o wrap de performance (Fase 1/2) nessas 7 tabelas, hoje
-- excluídas dela.

-- =====================================================================
-- profiles
-- =====================================================================

DROP POLICY IF EXISTS "users_can_view_own_profile" ON "public"."profiles";
CREATE POLICY "users_can_view_own_profile" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "users_can_update_own_profile" ON "public"."profiles";
CREATE POLICY "users_can_update_own_profile" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON "public"."profiles";
CREATE POLICY "admins_can_view_all_profiles" ON "public"."profiles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "admins_can_update_any_profile" ON "public"."profiles";
CREATE POLICY "admins_can_update_any_profile" ON "public"."profiles" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "admins_can_create_profiles" ON "public"."profiles";
CREATE POLICY "admins_can_create_profiles" ON "public"."profiles" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

-- admins_can_delete_profiles: NÃO existia em produção nem no design
-- original (20251130044928 bloqueou DELETE de propósito: "soft delete
-- via status é preferível... não criar política de DELETE significa
-- que ninguém pode deletar"). Adicionada aqui, deliberadamente, porque
-- src/pages/pessoas/Todos.tsx (handleDeletePessoa, gate `isAdmin`) faz
-- DELETE direto em profiles hoje em produção — funcionava só por causa
-- do bug FOR ALL sendo corrigido nesta mesma migration. Sem esta
-- policy, esse botão passaria a falhar silenciosamente (RLS nega, 0
-- linhas, toast de erro genérico) pra todo admin, no primeiro deploy
-- deste fix. Decisão consciente do usuário: preservar a feature em vez
-- de reativar o bloqueio original. Predicado idêntico às outras 3
-- policies de admin em profiles (has_role(admin) — não super_admin,
-- mesma convenção já usada por elas — + has_filial_access), sem
-- reduzir a proteção de dados sensíveis (CPF/RG/endereço) contra
-- QUALQUER outro ator: só admin da filial efetiva pode deletar.
CREATE POLICY "admins_can_delete_profiles" ON "public"."profiles" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

-- =====================================================================
-- eventos_convites
-- =====================================================================

DROP POLICY IF EXISTS "Admin e lider podem ver todos os convites" ON "public"."eventos_convites";
CREATE POLICY "Admin e lider podem ver todos os convites" ON "public"."eventos_convites" FOR SELECT USING ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'lider'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admin pode atualizar convites" ON "public"."eventos_convites";
CREATE POLICY "Admin pode atualizar convites" ON "public"."eventos_convites" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admin pode criar convites" ON "public"."eventos_convites";
CREATE POLICY "Admin pode criar convites" ON "public"."eventos_convites" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admin pode deletar convites" ON "public"."eventos_convites";
CREATE POLICY "Admin pode deletar convites" ON "public"."eventos_convites" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

-- =====================================================================
-- familias
-- =====================================================================

DROP POLICY IF EXISTS "Admins podem atualizar relacionamentos familiares" ON "public"."familias";
CREATE POLICY "Admins podem atualizar relacionamentos familiares" ON "public"."familias" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admins podem criar relacionamentos familiares" ON "public"."familias";
CREATE POLICY "Admins podem criar relacionamentos familiares" ON "public"."familias" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admins podem deletar relacionamentos familiares" ON "public"."familias";
CREATE POLICY "Admins podem deletar relacionamentos familiares" ON "public"."familias" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admins podem ver todos os relacionamentos familiares" ON "public"."familias";
CREATE POLICY "Admins podem ver todos os relacionamentos familiares" ON "public"."familias" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

-- =====================================================================
-- fornecedores
-- =====================================================================

DROP POLICY IF EXISTS "only_admins_can_delete_suppliers" ON "public"."fornecedores";
CREATE POLICY "only_admins_can_delete_suppliers" ON "public"."fornecedores" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "only_admins_treasurers_can_create_suppliers" ON "public"."fornecedores";
CREATE POLICY "only_admins_treasurers_can_create_suppliers" ON "public"."fornecedores" FOR INSERT WITH CHECK ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "only_admins_treasurers_can_update_suppliers" ON "public"."fornecedores";
CREATE POLICY "only_admins_treasurers_can_update_suppliers" ON "public"."fornecedores" FOR UPDATE USING ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id"))) WITH CHECK ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'tesoureiro'::"public"."app_role")) AND "public"."has_filial_access"("igreja_id", "filial_id")));

-- =====================================================================
-- inscricoes_eventos
-- =====================================================================

DROP POLICY IF EXISTS "Usuarios podem criar proprias inscricoes" ON "public"."inscricoes_eventos";
CREATE POLICY "Usuarios podem criar proprias inscricoes" ON "public"."inscricoes_eventos" FOR INSERT WITH CHECK ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))) AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Usuarios podem ver proprias inscricoes" ON "public"."inscricoes_eventos";
CREATE POLICY "Usuarios podem ver proprias inscricoes" ON "public"."inscricoes_eventos" FOR SELECT USING ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))) AND "public"."has_filial_access"("igreja_id", "filial_id")));

-- =====================================================================
-- visitante_contatos
-- =====================================================================

DROP POLICY IF EXISTS "Admins podem atualizar contatos" ON "public"."visitante_contatos";
CREATE POLICY "Admins podem atualizar contatos" ON "public"."visitante_contatos" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admins podem criar contatos" ON "public"."visitante_contatos";
CREATE POLICY "Admins podem criar contatos" ON "public"."visitante_contatos" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admins podem deletar contatos" ON "public"."visitante_contatos";
CREATE POLICY "Admins podem deletar contatos" ON "public"."visitante_contatos" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Admins podem ver todos os contatos" ON "public"."visitante_contatos";
CREATE POLICY "Admins podem ver todos os contatos" ON "public"."visitante_contatos" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros responsáveis podem atualizar seus contatos" ON "public"."visitante_contatos";
CREATE POLICY "Membros responsáveis podem atualizar seus contatos" ON "public"."visitante_contatos" FOR UPDATE USING ((("membro_responsavel_id" = "auth"."uid"()) AND "public"."has_filial_access"("igreja_id", "filial_id"))) WITH CHECK ((("membro_responsavel_id" = "auth"."uid"()) AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros responsáveis podem ver seus contatos" ON "public"."visitante_contatos";
CREATE POLICY "Membros responsáveis podem ver seus contatos" ON "public"."visitante_contatos" FOR SELECT USING ((("membro_responsavel_id" = "auth"."uid"()) AND "public"."has_filial_access"("igreja_id", "filial_id")));

-- =====================================================================
-- escalas
-- =====================================================================

DROP POLICY IF EXISTS "Voluntario confirma propria escala" ON "public"."escalas";
CREATE POLICY "Voluntario confirma propria escala" ON "public"."escalas" FOR UPDATE USING ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))) AND "public"."has_filial_access"("igreja_id", "filial_id"))) WITH CHECK ((("pessoa_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))) AND "public"."has_filial_access"("igreja_id", "filial_id")));
