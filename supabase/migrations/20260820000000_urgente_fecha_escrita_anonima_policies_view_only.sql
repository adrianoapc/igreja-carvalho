-- URGENTE — fecha escrita não-autenticada em 8 tabelas via policies
-- "visualizar/ver" que na verdade eram FOR ALL sem WITH CHECK.
--
-- Achado incidental durante /code-review da Fase 2 de performance
-- (multiple_permissive_policies) — não relacionado a ela, pré-existente.
-- CONFIRMADO POR EXPLORAÇÃO DIRETA num Postgres local restaurado do dump
-- real de produção (supabase db dump --linked): com `SET role anon;`
-- SEM NENHUM JWT (visitante não logado), consegui INSERT/UPDATE/DELETE
-- em `eventos`, INSERT em `cancoes_culto` e `escalas` — sem estar
-- logado, sem ser admin, sem ser membro de nada.
--
-- Causa raiz: public.has_filial_access(_igreja_id, _filial_id) trata
-- "sem JWT nenhum" (visitante anônimo) igual a "JWT autenticado antigo
-- sem o claim igreja_id" (comentário original: "backwards
-- compatibility") — as duas situações fazem current_setting(...)
-- retornar NULL, então a função não distingue uma da outra. E não é só
-- a branch "filial_id IS NULL" que passa: pra uma sessão SEM NENHUM
-- JWT, auth.uid() também é NULL, então o ramo legado "sem filial
-- primária E sem NENHUMA row em user_filial_access => acesso total"
-- (NOT EXISTS(...WHERE user_id = auth.uid()...), que nunca acha nada
-- com user_id NULL) também é vacuamente verdadeiro — CONFIRMADO por
-- teste direto: anon leu um evento de OUTRA igreja com filial_id
-- preenchido, não só linhas de filial compartilhada. Combinado com
-- policies PUBLIC (sem TO), sem FOR (= ALL implícito) e sem WITH
-- CHECK — que herdam o USING como check de escrita — o resultado é
-- acesso de ESCRITA público de verdade, e o de LEITURA é ainda mais
-- amplo (qualquer linha, de qualquer tenant, não só filial
-- compartilhada). Corrigir has_filial_access() em si é fase separada,
-- maior (usada em dezenas de outras policies que já são seguras porque
-- também exigem has_role(...) no mesmo AND — só quem usa
-- has_filial_access() SOZINHO, sem check de role/dono, é vulnerável).
-- Ver memória project-vulnerabilidade-critica-escrita-anonima-has-
-- filial-access pro relatório completo da investigação.
--
-- Por isso o fix abaixo não é só "adiciona FOR SELECT" — também
-- adiciona TO authenticated em todas as 8, fechando também o vazamento
-- de leitura cross-tenant pra anon (achado no /code-review local desta
-- própria migration, antes de qualquer push). Em `eventos`
-- especificamente, isso também para de neutralizar a policy
-- `anon_eventos_site` (TO anon, propositalmente restrita a eventos
-- publicados/futuros) — hoje ela coexistia com esta aqui (PUBLIC, sem
-- filtro de publicação), e Postgres faz OR entre policies permissivas,
-- então a mais ampla ganhava.
--
-- As 8 tabelas abaixo têm o padrão perigoso confirmado por leitura
-- direta do SQL (não inferido do nome): USING é `true AND
-- has_filial_access(...)` ou `<col> AND has_filial_access(...)`, SEM
-- nenhuma comparação com auth.uid() — diferente das ~40 outras
-- policies "Admins podem gerenciar X" que também usam
-- has_filial_access() mas AND'ado com has_role(admin), essas SIM
-- seguras (anon nunca passa has_role). Fix: adiciona FOR SELECT
-- (cláusula USING idêntica, sem nenhuma outra mudança) — os nomes já
-- diziam "visualizar"/"ver", a intenção sempre foi leitura.
--
-- eventos, cancoes_culto, escalas, membros_time: uso confirmado em
-- src/ (Eventos.tsx, MusicaTabContent.tsx, EscalasTabContent.tsx,
-- GerenciarTimeDialog.tsx) — pesquisa de código confirmou que a
-- escrita legítima de cada uma já é coberta por outra policy própria
-- (Admin gerencia eventos/canções; Voluntario confirma propria
-- escala + Lider gerencia escalas do seu time; Lider gerencia membros
-- do seu time). liturgia_culto, midias_culto, times_culto: tabelas do
-- módulo "cultos" sem uso confirmado em src/ hoje (auditoria
-- 20260819061000) — risco latente, fechado por consistência.
--
-- posicoes_time é EXCEÇÃO: pesquisa de código achou uso legítimo de
-- escrita por líder de time via GerenciarTimeDialog.tsx (gerenciar
-- posições do próprio time) que NÃO tinha nenhuma policy própria
-- cobrindo — só a admin-FOR-ALL e a buggy Membros-FOR-ALL. Por isso,
-- além do FOR SELECT, esta migration cria "Lider gerencia posições do
-- seu time" espelhando o padrão já usado em "Lider gerencia membros do
-- seu time" (mesma função is_time_leader()).
--
-- Nota de UX conhecida (pesquisa em src/ confirmou os casos abaixo):
-- eventos e cancoes_culto hoje não têm nenhum gate de role na UI
-- (qualquer usuário autenticado vê o dialog de edição, EventoDialog.tsx
-- e MusicaTabContent.tsx) — depois desta migration, um membro comum
-- que tentava salvar (e o RLS silenciosamente permitia, sem dever
-- permitir) passa a receber erro de permissão. escalas tem 2 versões
-- mais estreitas do mesmo problema: (a) EscalasTabContent.tsx gateia
-- adicionar/remover atrás de isAdmin = hasAccess("eventos",
-- "aprovar_gerenciar") — um predicado DIFERENTE do que a policy do
-- banco exige (has_role admin OU ser o líder/sublíder DAQUELE time
-- específico via is_time_leader()); um admin pode ter concedido esse
-- module_permission a um role tipo "pastor"/"secretario" sem ele ser
-- líder de nenhum time — essa pessoa vê o botão mas passa a receber
-- erro de permissão; (b) o botão de confirmar/desconfirmar presença
-- (handleToggleConfirmacao) aparece em TODA linha sem checar dono — só
-- "Voluntario confirma propria escala" cobre isso agora, então clicar
-- na escala de OUTRA pessoa passa a falhar (antes, a policy com bug
-- permitia). Em todos esses casos, correto do ponto de vista de
-- segurança (a intenção sempre foi restrita — admin-only, líder-only
-- ou dono-only, as policies próprias já existiam); esconder/
-- desabilitar os botões que não deveriam estar disponíveis é um
-- follow-up de frontend, fora do escopo desta migration de RLS.
--
-- MAIS VISÍVEL — página pública (`src/pages/Public.tsx`, rota
-- `/public/:slug`, sem login): lista `eventos` filtrando só por
-- status="confirmado" + data futura, SEM checar `publicar_no_site`.
-- Antes desta migration, a policy com bug vazava TODO evento
-- confirmado futuro pro público, com ou sem esse flag marcado — então
-- a seção "Próximos Cultos" do site público podia estar mostrando
-- cultos que ninguém marcou como "Publicar no site". Depois desta
-- migration, anon só enxerga via `anon_eventos_site` (exige
-- publicar_no_site=true, que é `false` por padrão em EventoDialog.tsx)
-- — se a maioria dos cultos cadastrados hoje não tem esse flag
-- marcado, a seção pode aparecer vazia ou quase vazia no site público
-- até a equipe da igreja passar a marcá-lo. Não é regressão de
-- segurança (o comportamento antigo é que estava errado), mas é
-- MUITO visível pra usuário final — avisar a equipe operacional antes
-- de aplicar, e considerar corrigir `Public.tsx` (adicionar o mesmo
-- filtro publicar_no_site que a policy já exige) como follow-up
-- imediato de frontend.

DROP POLICY IF EXISTS "Membros visualizam eventos" ON "public"."eventos";
CREATE POLICY "Membros visualizam eventos" ON "public"."eventos" FOR SELECT TO "authenticated" USING ((true AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros podem ver canções" ON "public"."cancoes_culto";
CREATE POLICY "Membros podem ver canções" ON "public"."cancoes_culto" FOR SELECT TO "authenticated" USING ((true AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros visualizam escalas" ON "public"."escalas";
CREATE POLICY "Membros visualizam escalas" ON "public"."escalas" FOR SELECT TO "authenticated" USING ((true AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros podem ver membros de times" ON "public"."membros_time";
CREATE POLICY "Membros podem ver membros de times" ON "public"."membros_time" FOR SELECT TO "authenticated" USING ((true AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros podem ver liturgia" ON "public"."liturgia_culto";
CREATE POLICY "Membros podem ver liturgia" ON "public"."liturgia_culto" FOR SELECT TO "authenticated" USING ((true AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros podem ver mídias" ON "public"."midias_culto";
CREATE POLICY "Membros podem ver mídias" ON "public"."midias_culto" FOR SELECT TO "authenticated" USING ((true AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros podem ver times ativos" ON "public"."times_culto";
CREATE POLICY "Membros podem ver times ativos" ON "public"."times_culto" FOR SELECT TO "authenticated" USING ((("ativo" = true) AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Membros podem ver posições ativas" ON "public"."posicoes_time";
CREATE POLICY "Membros podem ver posições ativas" ON "public"."posicoes_time" FOR SELECT TO "authenticated" USING ((("ativo" = true) AND "public"."has_filial_access"("igreja_id", "filial_id")));

DROP POLICY IF EXISTS "Lider gerencia posições do seu time" ON "public"."posicoes_time";
CREATE POLICY "Lider gerencia posições do seu time" ON "public"."posicoes_time" TO "authenticated" USING (("public"."is_time_leader"("auth"."uid"(), "time_id") AND "public"."has_filial_access"("igreja_id", "filial_id"))) WITH CHECK (("public"."is_time_leader"("auth"."uid"(), "time_id") AND "public"."has_filial_access"("igreja_id", "filial_id")));
