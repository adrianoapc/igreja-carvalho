-- Regression test pra public.claim_whatsapp_chatbot_wamid() /
-- complete_whatsapp_chatbot_wamid() / release_whatsapp_chatbot_wamid()
-- (ADR-033 PR2a-1) — achado real de /code-review local: lógica de
-- claim/fencing/lease/reclaim é exatamente o tipo de código que
-- CLAUDE.md pede verificação em harness Postgres real (2 sessões pra
-- concorrência de verdade seria o ideal; aqui cobrimos a máquina de
-- estado sequencialmente — RETURNING/ON CONFLICT DO UPDATE ... WHERE já
-- são atômicos por desenho do Postgres, não precisam de 2 sessões pra
-- provar isso, só pra provar QUE duas tentativas simultâneas convergem
-- pro mesmo resultado, o que os cenários abaixo já cobrem via
-- owner_token vencedor determinístico).
--
-- **AUTOCONTIDO, roda contra um Postgres 17 DESCARTÁVEL — não `supabase
-- start`** (mesmo racional do has_filial_access_test.sql — supabase db
-- reset falha por drift de migration conhecido, ver AGENTS.md). Cria só
-- os stubs mínimos (roles anon/authenticated/service_role,
-- update_updated_at_column()) e carrega o schema REAL via `\ir` do
-- próprio migration file.
--
--   docker run --rm -d --name wamid_test -e POSTGRES_PASSWORD=postgres \
--     -p 55432:5432 postgres:17-alpine
--   docker exec -u postgres wamid_test mkdir -p /tmp/supabase/tests /tmp/supabase/migrations
--   docker cp supabase/tests/whatsapp_chatbot_wamid_claim_test.sql \
--     wamid_test:/tmp/supabase/tests/whatsapp_chatbot_wamid_claim_test.sql
--   docker cp supabase/migrations/20260901000000_chatbot_wamid_claim_entrada.sql \
--     wamid_test:/tmp/supabase/migrations/20260901000000_chatbot_wamid_claim_entrada.sql
--   docker exec -u postgres wamid_test psql -U postgres -d postgres \
--     -f /tmp/supabase/tests/whatsapp_chatbot_wamid_claim_test.sql
--   docker rm -f wamid_test
--
-- Cada assert usa RAISE EXCEPTION on falha — o script inteiro para no
-- primeiro erro (fail-fast). "PASS" no final = todos os cenários OK.

\set ON_ERROR_STOP on

-- Stubs mínimos: roles do Supabase (o migration real faz GRANT/REVOKE/
-- CREATE POLICY TO authenticated/service_role) + a função de trigger
-- update_updated_at_column(), que em produção já existe de outra
-- migration (20251127...).
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Carrega o schema REAL (tabela + policies + as 3 RPCs) do migration
-- file — não uma cópia retypada — \ir resolve relativo a este arquivo.
\ir ../migrations/20260901000000_chatbot_wamid_claim_entrada.sql

SET ROLE service_role;

-- Scenario 1: claim novo (sem row prévia) -> owned=true, status=processing
DO $$ BEGIN
  IF NOT (SELECT owned FROM claim_whatsapp_chatbot_wamid(
    'wamid-1', 'triagem', 'a0000000-0000-4000-8000-000000000001'::uuid,
    '5511900000001', 150)) THEN
    RAISE EXCEPTION 'FAIL cenario 1: claim novo nao retornou owned=true';
  END IF;
  RAISE NOTICE 'PASS cenario 1: claim novo funciona';
END $$;

-- Scenario 2: mesmo wamid, dono DIFERENTE, lease ainda valida -> owned=false, status=processing (conflito genuino)
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM claim_whatsapp_chatbot_wamid(
    'wamid-1', 'triagem', 'a0000000-0000-4000-8000-000000000002'::uuid,
    '5511900000001', 150);
  IF r.owned OR r.status <> 'processing' THEN
    RAISE EXCEPTION 'FAIL cenario 2: 2a tentativa com lease valida nao deveria ganhar (owned=%, status=%)', r.owned, r.status;
  END IF;
  RAISE NOTICE 'PASS cenario 2: conflito genuino (lease valida) nao rouba a posse';
END $$;

-- Scenario 3: complete com o owner_token ORIGINAL -> sucesso (true)
DO $$ BEGIN
  IF NOT complete_whatsapp_chatbot_wamid(
    'wamid-1', 'triagem', 'a0000000-0000-4000-8000-000000000001'::uuid,
    '{"reply_message":"oi joao"}'::jsonb, 200, 3600) THEN
    RAISE EXCEPTION 'FAIL cenario 3: complete com dono correto deveria retornar true';
  END IF;
  RAISE NOTICE 'PASS cenario 3: complete com dono correto funciona';
END $$;

-- Scenario 4: complete de novo com owner_token ERRADO -> no-op (false), nao sobrescreve
DO $$ BEGIN
  IF complete_whatsapp_chatbot_wamid(
    'wamid-1', 'triagem', 'ffffffff-0000-4000-8000-000000000099'::uuid,
    '{"reply_message":"hacked"}'::jsonb, 200, 3600) THEN
    RAISE EXCEPTION 'FAIL cenario 4: complete com dono errado nao deveria conseguir sobrescrever (fencing quebrado)';
  END IF;
  RAISE NOTICE 'PASS cenario 4: fencing de owner_token protege complete()';
END $$;

-- Scenario 5: replay com o MESMO telefone -> owned=false, status=completed, telefone_match=true, resposta cacheada volta
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM claim_whatsapp_chatbot_wamid(
    'wamid-1', 'triagem', 'a0000000-0000-4000-8000-000000000003'::uuid,
    '5511900000001', 150);
  IF r.owned OR r.status <> 'completed' OR NOT r.telefone_match
     OR r.response_payload IS DISTINCT FROM '{"reply_message":"oi joao"}'::jsonb THEN
    RAISE EXCEPTION 'FAIL cenario 5: replay com mesmo telefone deveria devolver a resposta cacheada (got owned=%, status=%, match=%, payload=%)',
      r.owned, r.status, r.telefone_match, r.response_payload;
  END IF;
  RAISE NOTICE 'PASS cenario 5: replay legitimo (mesmo telefone) recebe a resposta cacheada';
END $$;

-- Scenario 6: replay com telefone DIFERENTE -> telefone_match=false, e response_payload/status vem NULL
-- (a RPC suprime, nao so o caller) — nunca vaza a resposta cacheada de outra conversa.
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM claim_whatsapp_chatbot_wamid(
    'wamid-1', 'triagem', 'a0000000-0000-4000-8000-000000000004'::uuid,
    '5599999999999', 150);
  IF r.telefone_match OR r.response_payload IS NOT NULL OR r.response_status IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL cenario 6: telefone diferente deveria ter telefone_match=false E payload/status suprimidos (got match=%, payload=%, status=%)',
      r.telefone_match, r.response_payload, r.response_status;
  END IF;
  RAISE NOTICE 'PASS cenario 6: telefone diferente nao vaza a resposta cacheada (suprimida na propria RPC)';
END $$;

-- Scenario 7: release por dono ERRADO -> no-op (false)
DO $$ BEGIN
  INSERT INTO whatsapp_chatbot_wamid_claim (wamid, chatbot, status, owner_token, lease_until, telefone)
  VALUES ('wamid-2', 'financeiro', 'processing', 'b0000000-0000-4000-8000-000000000001'::uuid,
          now() + interval '150 seconds', '5511900000002');
  IF release_whatsapp_chatbot_wamid('wamid-2', 'financeiro', 'ffffffff-0000-4000-8000-000000000099'::uuid) THEN
    RAISE EXCEPTION 'FAIL cenario 7: release com dono errado nao deveria conseguir (fencing quebrado)';
  END IF;
  RAISE NOTICE 'PASS cenario 7: fencing de owner_token protege release()';
END $$;

-- Scenario 8: release pelo dono CERTO -> lease expira IMEDIATAMENTE (nao precisa esperar os 150s)
DO $$ DECLARE v_lease_until timestamptz; BEGIN
  IF NOT release_whatsapp_chatbot_wamid('wamid-2', 'financeiro', 'b0000000-0000-4000-8000-000000000001'::uuid) THEN
    RAISE EXCEPTION 'FAIL cenario 8: release com dono correto deveria retornar true';
  END IF;
  SELECT lease_until INTO v_lease_until FROM whatsapp_chatbot_wamid_claim WHERE wamid='wamid-2' AND chatbot='financeiro';
  IF v_lease_until > now() THEN
    RAISE EXCEPTION 'FAIL cenario 8: release deveria zerar a lease pra now(), ainda esta no futuro (%)', v_lease_until;
  END IF;
  RAISE NOTICE 'PASS cenario 8: release expira a lease imediatamente';
END $$;

-- Scenario 9: novo claim IMEDIATO apos release consegue reclamar (owned=true) — sem esperar os 150s
-- originais. Fecha o achado real de /code-review: exceção/erro >=400 no
-- processamento não pode travar um redelivery legítimo em 409 até o lease vencer.
DO $$ BEGIN
  IF NOT (SELECT owned FROM claim_whatsapp_chatbot_wamid(
    'wamid-2', 'financeiro', 'b0000000-0000-4000-8000-000000000002'::uuid,
    '5511900000002', 150)) THEN
    RAISE EXCEPTION 'FAIL cenario 9: claim imediato apos release deveria conseguir a posse';
  END IF;
  RAISE NOTICE 'PASS cenario 9: reclaim imediato apos release funciona (fecha o achado do redelivery preso)';
END $$;

-- Scenario 10: complete com TTL curto, espera vencer, reclaim de completed funciona (reseta pra processing, limpa payload).
-- now() e por-transacao no Postgres (fixo no inicio da transaction, nao
-- reflete pg_sleep DENTRO da mesma transaction) — por isso o complete(),
-- o sleep e o reclaim precisam ser 3 statements top-level SEPARADOS
-- (3 transactions distintas em autocommit), nao 1 DO block so.
DO $$ BEGIN
  PERFORM complete_whatsapp_chatbot_wamid(
    'wamid-2', 'financeiro', 'b0000000-0000-4000-8000-000000000002'::uuid,
    '{"ok":true}'::jsonb, 200, 1);
END $$;
SELECT pg_sleep(1.2);
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM claim_whatsapp_chatbot_wamid(
    'wamid-2', 'financeiro', 'b0000000-0000-4000-8000-000000000003'::uuid,
    '5511900000002', 150);
  IF NOT r.owned OR r.status <> 'processing' THEN
    RAISE EXCEPTION 'FAIL cenario 10: completed com janela de cache vencida deveria ser reclamavel (got owned=%, status=%)', r.owned, r.status;
  END IF;
  IF EXISTS (
    SELECT 1 FROM whatsapp_chatbot_wamid_claim
    WHERE wamid='wamid-2' AND chatbot='financeiro' AND response_payload IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL cenario 10: reclaim de completed deveria limpar response_payload';
  END IF;
  RAISE NOTICE 'PASS cenario 10: completed com TTL vencido e reclamavel (nao cacheia pra sempre)';
END $$;

-- Scenario 11: mesmo wamid em chatbots DIFERENTES nao colide (PK inclui chatbot)
DO $$ BEGIN
  IF NOT (SELECT owned FROM claim_whatsapp_chatbot_wamid(
    'wamid-1', 'financeiro', 'c0000000-0000-4000-8000-000000000001'::uuid,
    '5511900000001', 150)) THEN
    RAISE EXCEPTION 'FAIL cenario 11: wamid-1/financeiro deveria ser independente de wamid-1/triagem (ja completed)';
  END IF;
  RAISE NOTICE 'PASS cenario 11: namespaces triagem/financeiro nao colidem pro mesmo wamid';
END $$;

-- Scenario 12: p_lease_seconds/p_cache_seconds <= 0 sao rejeitados (nunca uma lease ja-vencida na criacao)
DO $$ BEGIN
  BEGIN
    PERFORM claim_whatsapp_chatbot_wamid('wamid-3', 'triagem', 'd0000000-0000-4000-8000-000000000001'::uuid, '5511900000003', 0);
    RAISE EXCEPTION 'FAIL cenario 12a: p_lease_seconds=0 deveria ter sido rejeitado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'p_lease_seconds%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM complete_whatsapp_chatbot_wamid('wamid-1', 'financeiro', 'c0000000-0000-4000-8000-000000000001'::uuid, '{}'::jsonb, 200, -1);
    RAISE EXCEPTION 'FAIL cenario 12b: p_cache_seconds negativo deveria ter sido rejeitado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'p_cache_seconds%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS cenario 12: p_lease_seconds/p_cache_seconds <= 0 sao rejeitados';
END $$;

-- Scenario 14: telefone NULL (payload malformado, sem telefone extraivel) NAO quebra o claim
-- (achado real de /code-review local, 4 rodadas independentes convergindo no mesmo ponto:
-- telefone era NOT NULL, um p_telefone NULL fazia o INSERT falhar -> claimError -> fail-open
-- total, desligando a idempotencia justo no caso onde mais importa).
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM claim_whatsapp_chatbot_wamid(
    'wamid-4', 'triagem', 'e0000000-0000-4000-8000-000000000001'::uuid, NULL, 150);
  IF NOT r.owned THEN
    RAISE EXCEPTION 'FAIL cenario 14a: claim com telefone NULL deveria funcionar (owned=true), nao estourar erro';
  END IF;
  RAISE NOTICE 'PASS cenario 14a: claim com telefone NULL nao quebra (NOT NULL removido)';
END $$;

-- Scenario 15: 2 replays do MESMO wamid, ambos SEM telefone (mesmo payload malformado
-- reentregue) -> telefone_match=true (IS NOT DISTINCT FROM, nao =) -> resposta cacheada
-- servida normalmente, nao cai em "mismatch" por NULL = NULL avaliar NULL.
DO $$ BEGIN
  PERFORM complete_whatsapp_chatbot_wamid(
    'wamid-4', 'triagem', 'e0000000-0000-4000-8000-000000000001'::uuid,
    '{"reply_message":"sem telefone"}'::jsonb, 200, 3600);
END $$;
DO $$ DECLARE r RECORD; BEGIN
  SELECT * INTO r FROM claim_whatsapp_chatbot_wamid(
    'wamid-4', 'triagem', 'e0000000-0000-4000-8000-000000000002'::uuid, NULL, 150);
  IF r.owned OR r.status <> 'completed' OR NOT r.telefone_match OR r.response_payload IS NULL THEN
    RAISE EXCEPTION 'FAIL cenario 15: replay com telefone NULL nos 2 lados deveria bater telefone_match=true e servir o cache (got owned=%, status=%, match=%, payload=%)',
      r.owned, r.status, r.telefone_match, r.response_payload;
  END IF;
  RAISE NOTICE 'PASS cenario 15: telefone NULL nos 2 lados combina (IS NOT DISTINCT FROM) e serve o cache';
END $$;

RESET ROLE;

-- Scenario 13: RLS — authenticated nao le nem escreve nada na tabela (nem com GRANT nenhum,
-- que é o caso real: a migration não concede nada a authenticated).
SET ROLE authenticated;
DO $$ DECLARE v_count integer; v_denied boolean := false; BEGIN
  BEGIN
    SELECT count(*) INTO v_count FROM whatsapp_chatbot_wamid_claim;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied AND v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL cenario 13a: authenticated conseguiu ler rows da tabela (esperado: 0 rows ou permission denied)';
  END IF;
  BEGIN
    INSERT INTO whatsapp_chatbot_wamid_claim (wamid, chatbot, owner_token, lease_until, telefone)
    VALUES ('wamid-attack', 'triagem', gen_random_uuid(), now() + interval '150 sec', '5511900000000');
    RAISE EXCEPTION 'FAIL cenario 13b: authenticated conseguiu INSERT na tabela (RLS/GRANT quebrado)';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'PASS cenario 13: authenticated nao le nem escreve na tabela';
END $$;
RESET ROLE;

-- Cleanup
DELETE FROM public.whatsapp_chatbot_wamid_claim WHERE wamid IN ('wamid-1', 'wamid-2', 'wamid-3', 'wamid-4', 'wamid-attack');

\echo 'whatsapp_chatbot_wamid_claim_test.sql: TODOS OS CENARIOS PASSARAM'
