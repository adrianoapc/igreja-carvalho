-- Fix: "Publico pode ver recursos liturgia" (20251203233713) é
-- `FOR SELECT TO anon, authenticated USING (true)`, criada antes do
-- modelo multi-tenant (igreja_id/filial_id) existir, pra dar leitura
-- anônima ao telão (TelaoLiturgia.tsx, rota pública /telao/liturgia/:id,
-- fora de qualquer AuthGate, criada no mesmo commit).
--
-- Ela nunca foi restrita depois: 20260104060625 adicionou "Todos podem ver
-- recursos liturgia" (has_filial_access) sob NOME NOVO em vez de
-- substituir a antiga, e 20260820020000 (merge de performance) só
-- absorveu essa nova + "Admins podem gerenciar recursos liturgia" em
-- perf_merge_000_select_pub -- "Publico pode ver recursos liturgia"
-- continua viva, separada, combinando via OR (policies do mesmo comando
-- são sempre OR'd, independente de terem `roles` diferentes).
--
-- Resultado: qualquer usuário AUTHENTICATED (de QUALQUER igreja) lê
-- liturgia_recursos de QUALQUER outra igreja hoje, porque o branch
-- `authenticated` do `USING(true)` nunca checa tenant -- mesma classe do
-- #135. `has_filial_access()` em si já foi endurecida (20260822130000)
-- pra negar anon estruturalmente, mas essa policy nem passa pela função:
-- é `true` puro.
--
-- Fix: restringe a policy pra `TO anon` apenas (remove `authenticated` do
-- `TO`). Authenticated continua coberto por perf_merge_000_select_pub
-- (has_filial_access), sem regressão. Anon (telão) fica bit-a-bit
-- idêntico -- só o branch que sobrava pra authenticated (o vazamento) sai.
--
-- Mesmo padrão do fix em 20260831140000 pra midias (que tinha o mesmo
-- problema: policy órfã PUBLIC sustentando o telão, com o branch
-- authenticated redundante vazando cross-tenant).

DROP POLICY IF EXISTS "Publico pode ver recursos liturgia" ON "public"."liturgia_recursos";
CREATE POLICY "Publico pode ver recursos liturgia" ON "public"."liturgia_recursos"
  FOR SELECT
  TO "anon"
  USING (true);
COMMENT ON POLICY "Publico pode ver recursos liturgia" ON "public"."liturgia_recursos" IS
  'fix 20260831150000: restringe de TO anon,authenticated pra TO anon -- fecha vazamento cross-tenant pra authenticated (perf_merge_000_select_pub já cobre authenticated via has_filial_access), preserva o telão anônimo';
