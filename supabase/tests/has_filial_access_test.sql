-- Regression test pra public.has_filial_access() / get_jwt_igreja_id() /
-- get_jwt_filial_id() — fecha o gap apontado em review da PR #135
-- ("harness não commitado, próxima redefinição não tem como não reabrir
-- Bug A/B sem perceber", ver docs/guardrails-financeiro.md item M.8).
--
-- Cobre os 2 exploits fechados por 20260827130000 (usuário autocadastrado
-- sem convite ganhando acesso a QUALQUER tenant; forja de claim via
-- user_metadata) e as 7 rotas legítimas que precisam continuar
-- funcionando (legado com profile real, claim direto, service_role/bot
-- com e sem filial, admin global, claim via request.jwt.claim.igreja_id,
-- anon sem JWT nenhum).
--
-- **AUTOCONTIDO, roda contra um Postgres 17 DESCARTÁVEL — não `supabase
-- start`** (achado real de `@codex review`, P1, PR #135: numa checkout
-- limpa, `supabase start`/`supabase db reset` falha no meio do histórico
-- de migrations com drift conhecido — ver AGENTS.md e
-- docs/guardrails-financeiro.md — então o teste nunca chegaria a rodar).
-- Este script cria só os stubs mínimos de que has_filial_access()
-- depende (schema `auth`, tipo `app_role`, `profiles`/`user_roles`/
-- `user_filial_access`, `has_role()`) e carrega as funções REAIS via
-- `\ir` do próprio migration file — não uma cópia retypada — então o
-- teste sempre valida o código de verdade que será deployado.
--
--   docker run --rm -d --name hfa_test -e POSTGRES_PASSWORD=postgres \
--     -p 55432:5432 postgres:17
--   docker cp supabase/tests/has_filial_access_test.sql hfa_test:/tmp/
--   docker cp supabase/migrations/20260827130000_fix_has_filial_access_legacy_claim_bypass.sql \
--     hfa_test:/tmp/20260827130000_fix_has_filial_access_legacy_claim_bypass.sql
--   docker exec -u postgres hfa_test psql -U postgres -d postgres -f /tmp/has_filial_access_test.sql
--   docker rm -f hfa_test
--
-- (o `\ir` abaixo resolve relativo ao PRÓPRIO arquivo, então rodar via
-- `psql -f supabase/tests/has_filial_access_test.sql` de dentro do
-- checkout do repo — sem copiar pro container — também funciona, desde
-- que o Postgres alvo seja descartável, nunca produção nem o stack
-- local de outro projeto.)
--
-- Cada assert usa RAISE EXCEPTION on falha — o script inteiro para no
-- primeiro erro (fail-fast). "PASS" no final = todos os 11 cenários OK.
-- Precisa de reconexão real (\connect) pro cenário 7 (anon sem JWT
-- nenhum) — `RESET`/`set_config(..., NULL, ...)` numa sessão que já
-- tocou o GUC volta pra '' (string vazia), não NULL, e ''::jsonb
-- explode; só uma sessão nova reproduz "GUC genuinamente ausente" de
-- verdade (mesma lição documentada no item M.7 do guardrails).

\set ON_ERROR_STOP on

-- Stubs mínimos (schema completo real fica em supabase/migrations/;
-- aqui só o suficiente pra has_filial_access() rodar isolada)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
$$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM
    ('admin','super_admin','admin_igreja','admin_filial','tesoureiro','lider','secretario','visitante');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL,
  role public.app_role NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  nome text,
  email text,
  status text,
  igreja_id uuid,
  filial_id uuid
);

CREATE TABLE IF NOT EXISTS public.user_filial_access (
  user_id uuid NOT NULL,
  igreja_id uuid NOT NULL,
  filial_id uuid NOT NULL,
  can_view boolean NOT NULL DEFAULT true
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  OR (
    _role = 'admin'::public.app_role
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('admin_igreja'::public.app_role, 'admin_filial'::public.app_role)
    )
  )
$$;

-- Carrega has_filial_access()/get_jwt_igreja_id()/get_jwt_filial_id()
-- REAIS do migration file (não uma cópia) — \ir resolve relativo a
-- este próprio arquivo, independente do cwd de onde psql foi chamado.
\ir ../migrations/20260827130000_fix_has_filial_access_legacy_claim_bypass.sql

-- Fixtures (sentinelas óbvios, nunca colidem com dado real)
DELETE FROM public.user_roles WHERE user_id IN (
  '00000000-0000-4000-8000-000000000004'
);
DELETE FROM public.profiles WHERE user_id IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004'
);
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004'
);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000000001', 'teste-visitante-hfa@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'teste-legado-hfa@example.invalid'),
  ('00000000-0000-4000-8000-000000000003', 'teste-filial-hfa@example.invalid'),
  ('00000000-0000-4000-8000-000000000004', 'teste-admin-hfa@example.invalid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, nome, email, status, igreja_id, filial_id) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Teste Visitante', 'teste-visitante-hfa@example.invalid', 'visitante', NULL, NULL),
  ('00000000-0000-4000-8000-000000000002', 'Teste Legado', 'teste-legado-hfa@example.invalid', 'ativo', 'aaaaaaaa-0000-4000-8000-00000000000a', NULL),
  ('00000000-0000-4000-8000-000000000003', 'Teste Filial', 'teste-filial-hfa@example.invalid', 'ativo', 'aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b'),
  ('00000000-0000-4000-8000-000000000004', 'Teste Admin', 'teste-admin-hfa@example.invalid', 'ativo', NULL, NULL)
ON CONFLICT (user_id) DO UPDATE SET
  igreja_id = EXCLUDED.igreja_id, filial_id = EXCLUDED.filial_id, status = EXCLUDED.status;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-4000-8000-000000000004', 'admin')
ON CONFLICT DO NOTHING;

-- Scenario 1: fresh unassigned self-signup (auth.uid set, NO jwt claim) checking VICTIM igreja
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001"}', false);
DO $$ BEGIN
  IF public.has_filial_access('cccccccc-0000-4000-8000-00000000000c'::uuid, NULL) THEN
    RAISE EXCEPTION 'FAIL cenario 1: visitante autocadastrado ganhou acesso a tenant alheio (Bug A reaberto)';
  END IF;
  RAISE NOTICE 'PASS cenario 1: visitante sem igreja nao acessa tenant alheio';
END $$;

-- Scenario 2: real legacy user (profile.igreja_id = A), NO jwt claim, checking OWN igreja A
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002"}', false);
DO $$ BEGIN
  IF NOT public.has_filial_access('aaaaaaaa-0000-4000-8000-00000000000a'::uuid, NULL) THEN
    RAISE EXCEPTION 'FAIL cenario 2: usuario legado perdeu acesso a propria igreja (regressao)';
  END IF;
  RAISE NOTICE 'PASS cenario 2: usuario legado mantem acesso a propria igreja';
END $$;

-- Scenario 3: same legacy user, checking a VICTIM igreja (core Bug A)
DO $$ BEGIN
  IF public.has_filial_access('cccccccc-0000-4000-8000-00000000000c'::uuid, NULL) THEN
    RAISE EXCEPTION 'FAIL cenario 3: usuario legado de uma igreja acessou outra (Bug A reaberto)';
  END IF;
  RAISE NOTICE 'PASS cenario 3: usuario legado nao atravessa pra outro tenant';
END $$;

-- Scenario 4: user_metadata forgery — attacker sets user_metadata.igreja_id to victim tenant
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","user_metadata":{"igreja_id":"cccccccc-0000-4000-8000-00000000000c"}}', false);
DO $$ BEGIN
  IF public.has_filial_access('cccccccc-0000-4000-8000-00000000000c'::uuid, NULL) THEN
    RAISE EXCEPTION 'FAIL cenario 4: forja de user_metadata concedeu acesso (Bug B reaberto)';
  END IF;
  RAISE NOTICE 'PASS cenario 4: user_metadata forjado nao concede acesso';
END $$;

-- Scenario 5: legit app_metadata claim (server-issued), direct match
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","app_metadata":{"igreja_id":"aaaaaaaa-0000-4000-8000-00000000000a","filial_id":"bbbbbbbb-0000-4000-8000-00000000000b"}}', false);
DO $$ BEGIN
  IF NOT public.has_filial_access('aaaaaaaa-0000-4000-8000-00000000000a'::uuid, 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid) THEN
    RAISE EXCEPTION 'FAIL cenario 5: claim direto via app_metadata parou de funcionar';
  END IF;
  RAISE NOTICE 'PASS cenario 5: claim direto via app_metadata funciona';
END $$;

-- Scenario 6: same legit claim, different filial of same igreja, no user_filial_access grant
DO $$ BEGIN
  IF public.has_filial_access('aaaaaaaa-0000-4000-8000-00000000000a'::uuid, 'dddddddd-0000-4000-8000-00000000000d'::uuid) THEN
    RAISE EXCEPTION 'FAIL cenario 6: acessou filial sem grant dentro da propria igreja';
  END IF;
  RAISE NOTICE 'PASS cenario 6: sem grant, filial diferente da propria continua negada';
END $$;

-- Scenario 8: service_role channel (bot/edge functions), any filial and NULL filial
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
DO $$ BEGIN
  IF NOT public.has_filial_access('cccccccc-0000-4000-8000-00000000000c'::uuid, 'eeeeeeee-0000-4000-8000-00000000000e'::uuid) THEN
    RAISE EXCEPTION 'FAIL cenario 8a: canal service_role perdeu acesso (quebraria fin_* do bot)';
  END IF;
  IF NOT public.has_filial_access('cccccccc-0000-4000-8000-00000000000c'::uuid, NULL) THEN
    RAISE EXCEPTION 'FAIL cenario 8b: canal service_role perdeu acesso com filial NULL';
  END IF;
  RAISE NOTICE 'PASS cenario 8: canal service_role/bot mantido intocado';
END $$;

-- Scenario 9: global admin, must access any tenant/filial
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004"}', false);
DO $$ BEGIN
  IF NOT public.has_filial_access('cccccccc-0000-4000-8000-00000000000c'::uuid, 'dddddddd-0000-4000-8000-00000000000d'::uuid) THEN
    RAISE EXCEPTION 'FAIL cenario 9: admin global perdeu acesso irrestrito';
  END IF;
  RAISE NOTICE 'PASS cenario 9: admin global mantem acesso irrestrito';
END $$;

-- Scenario 10: legit claim via dotted request.jwt.claim.igreja_id path
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003"}', false);
SELECT set_config('request.jwt.claim.igreja_id', 'aaaaaaaa-0000-4000-8000-00000000000a', false);
SELECT set_config('request.jwt.claim.filial_id', 'bbbbbbbb-0000-4000-8000-00000000000b', false);
DO $$ BEGIN
  IF NOT public.has_filial_access('aaaaaaaa-0000-4000-8000-00000000000a'::uuid, 'bbbbbbbb-0000-4000-8000-00000000000b'::uuid) THEN
    RAISE EXCEPTION 'FAIL cenario 10: claim via request.jwt.claim.igreja_id parou de funcionar';
  END IF;
  RAISE NOTICE 'PASS cenario 10: claim via request.jwt.claim.igreja_id funciona';
END $$;
SELECT set_config('request.jwt.claim.igreja_id', '', false);
SELECT set_config('request.jwt.claim.filial_id', '', false);

-- Scenario 11: profiles.igreja_id NULL AND target NULL — has_filial_access(NULL,NULL)
-- deve seguir negando pra sessao sem claim (achado do review /cursoragent na PR #135:
-- este caso passou de true pra false com o fix; nao ha fallback de "propria linha"
-- na policy de UPDATE de profiles pra visitante sem tenant — ver nota no migration
-- header. Aqui so travamos o valor de has_filial_access em si, nao a policy.)
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001"}', false);
DO $$ BEGIN
  IF public.has_filial_access(NULL, NULL) THEN
    RAISE EXCEPTION 'FAIL cenario 11: has_filial_access(NULL,NULL) voltou a ser true pra visitante sem tenant';
  END IF;
  RAISE NOTICE 'PASS cenario 11: has_filial_access(NULL,NULL) nega visitante sem tenant';
END $$;

-- Scenario 7: anon com NENHUM JWT (GUC genuinamente ausente) — precisa de sessao
-- nova de verdade; set_config/RESET numa sessao ja suja volta pra '', nao NULL.
\connect postgres
DO $$ BEGIN
  IF public.has_filial_access('cccccccc-0000-4000-8000-00000000000c'::uuid, NULL) THEN
    RAISE EXCEPTION 'FAIL cenario 7: anon sem JWT nenhum ganhou acesso (regressao do fix original da PR #124/#132)';
  END IF;
  RAISE NOTICE 'PASS cenario 7: anon sem JWT nenhum continua negado';
END $$;

-- Cleanup
DELETE FROM public.user_roles WHERE user_id = '00000000-0000-4000-8000-000000000004';
DELETE FROM public.profiles WHERE user_id IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004'
);
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004'
);

\echo 'has_filial_access_test.sql: TODOS OS 11 CENARIOS PASSARAM'
