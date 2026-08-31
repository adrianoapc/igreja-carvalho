-- Fecha vazamento cross-tenant em edge_function_logs (ADR-033 Passo 3 / PR0
-- do fatiamento em PRs empilhadas).
--
-- edge_function_logs não tem igreja_id — a policy de SELECT liberava
-- QUALQUER admin de QUALQUER igreja pra ler request_payload/response_payload
-- de execuções de outras igrejas (o front hoje faz .select("*") na lista de
-- logs, então o vazamento já acontece no carregamento da tela, não só ao
-- abrir um detalhe). Até a tabela ganhar igreja_id + RLS por tenant (fix
-- maior, fora de escopo aqui), restringe a leitura a super_admin.
DROP POLICY IF EXISTS "Admins podem visualizar logs" ON "public"."edge_function_logs";

CREATE POLICY "Super admins podem visualizar logs"
ON "public"."edge_function_logs"
FOR SELECT
TO "authenticated"
USING (has_role((select auth.uid()), 'super_admin'::app_role));
