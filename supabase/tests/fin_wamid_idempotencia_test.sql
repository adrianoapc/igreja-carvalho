-- Regression test pra idempotência de ledger em fin_criar_lancamento()/
-- fin_criar_transferencia() por wamid (ADR-033 PR2a-2). Fecha o gap de
-- "harness não commitado pra RPC financeira sensível" (mesmo racional
-- de supabase/tests/has_filial_access_test.sql).
--
-- **AUTOCONTIDO, roda contra um Postgres 17 DESCARTÁVEL — não `supabase
-- start`** (`supabase db reset` falha por drift de migration conhecido,
-- ver AGENTS.md/CLAUDE.md). Este harness NÃO carrega o histórico real
-- de migrations (impraticável — centenas de arquivos com dependências
-- cruzadas de todo o módulo financeiro). Em vez disso:
--   - Stuba `fin_resolver_contexto`/`has_filial_access` com versões
--     simplificadas (sem auth.*/profiles/user_roles) — a lógica de
--     tenant/filial delas já é coberta por has_filial_access_test.sql e
--     não é o alvo deste harness.
--   - Recria `fin_validar_fk_tenant`/`fin_validar_fk_filial`/
--     `fin_registrar_auditoria` com o corpo REAL (são puro SQL sem
--     dependência de auth, copiados fiel aos migrations-fonte — ver
--     comentário em cada uma).
--   - Carrega `fin_criar_lancamento`/`fin_criar_transferencia` REAIS
--     via `\ir` do próprio migration desta PR (não uma cópia retypada)
--     — é o código que será deployado de verdade.
-- O alvo deste harness é especificamente a lógica NOVA (ON CONFLICT/
-- índice único/wamid_item_key/numero_parcela), não uma re-validação da
-- lógica de tenant/filial pré-existente (já coberta noutro lugar).
--
--   docker run --rm -d --name fin_wamid_test -e POSTGRES_PASSWORD=postgres \
--     -p 55432:5432 postgres:17-alpine
--   docker exec -u postgres fin_wamid_test mkdir -p /tmp/supabase/tests /tmp/supabase/migrations
--   docker cp supabase/tests/fin_wamid_idempotencia_test.sql \
--     fin_wamid_test:/tmp/supabase/tests/fin_wamid_idempotencia_test.sql
--   docker cp supabase/migrations/20260902000000_fin_wamid_idempotencia_ledger.sql \
--     fin_wamid_test:/tmp/supabase/migrations/20260902000000_fin_wamid_idempotencia_ledger.sql
--   docker exec -u postgres fin_wamid_test psql -U postgres -d postgres \
--     -f /tmp/supabase/tests/fin_wamid_idempotencia_test.sql
--   docker rm -f fin_wamid_test
--
-- Cada assert usa RAISE EXCEPTION on falha — o script inteiro para no
-- primeiro erro (fail-fast). "PASS" no final = todos os cenários OK.

\set ON_ERROR_STOP on

-- ─── Stubs mínimos ──────────────────────────────────────────────────────

CREATE TABLE public.igrejas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text);
CREATE TABLE public.filiais (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), igreja_id uuid, nome text);
CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, nome text);
CREATE TABLE public.sessoes_contagem (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.solicitacoes_reembolso (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.atendimentos_bot (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

-- Stub simplificado — não replica auth.uid()/profiles/user_roles (fora
-- do escopo deste harness, coberto noutro lugar). Só mapeia p_contexto
-- pro shape de saída real (5 chaves), igual ao caminho service_role/bot
-- que chatbot-financeiro usa de verdade.
CREATE OR REPLACE FUNCTION public.fin_resolver_contexto(
  p_contexto jsonb DEFAULT NULL,
  p_flag_bot text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'igreja_id', p_contexto ->> 'igreja_id',
    'filial_id', p_contexto ->> 'filial_id',
    'ator_profile_id', p_contexto ->> 'ator_profile_id',
    'ator_user_id', p_contexto ->> 'ator_profile_id',
    'canal', COALESCE(p_contexto ->> 'canal', 'bot')
  );
END;
$$;

-- Stub — sempre concede (a lógica real de tenant/filial não é o alvo
-- deste harness, ver has_filial_access_test.sql).
CREATE OR REPLACE FUNCTION public.has_filial_access(_igreja_id uuid, _filial_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true; $$;

-- Corpo REAL (supabase/migrations/20260729100000_fin_recebivel_getnet_importacao.sql:200-233).
CREATE OR REPLACE FUNCTION public.fin_validar_fk_tenant(p_tabela text, p_id uuid, p_igreja_id uuid)
RETURNS void LANGUAGE plpgsql STABLE AS $$
DECLARE v_ok boolean;
BEGIN
  IF p_id IS NULL THEN RETURN; END IF;
  IF p_tabela NOT IN ('contas','categorias_financeiras','subcategorias_financeiras',
                      'centros_custo','bases_ministeriais','fornecedores',
                      'transacoes_financeiras','transferencias_contas',
                      'sessoes_contagem','solicitacoes_reembolso','formas_pagamento',
                      'integracoes_financeiras') THEN
    RAISE EXCEPTION 'FIN_FK: tabela % não suportada', p_tabela;
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id = $1 AND igreja_id = $2)', p_tabela)
    INTO v_ok USING p_id, p_igreja_id;
  IF NOT v_ok THEN RAISE EXCEPTION 'FIN_FK: % (%) inexistente ou fora do tenant', p_tabela, p_id; END IF;
END;
$$;

-- Corpo REAL (supabase/migrations/20260731260000_fin_validar_fk_filial_todos_campos.sql:34-68).
CREATE OR REPLACE FUNCTION public.fin_validar_fk_filial(p_tabela text, p_id uuid, p_filial_efetiva uuid)
RETURNS void LANGUAGE plpgsql STABLE AS $$
DECLARE v_filial_recurso uuid;
BEGIN
  IF p_id IS NULL THEN RETURN; END IF;
  IF p_tabela NOT IN ('categorias_financeiras','subcategorias_financeiras',
                      'centros_custo','bases_ministeriais','fornecedores',
                      'formas_pagamento') THEN
    RAISE EXCEPTION 'FIN_FK: tabela % não suportada por fin_validar_fk_filial', p_tabela;
  END IF;
  EXECUTE format('SELECT filial_id FROM public.%I WHERE id = $1', p_tabela) INTO v_filial_recurso USING p_id;
  IF v_filial_recurso IS NOT NULL AND v_filial_recurso IS DISTINCT FROM p_filial_efetiva THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: % (%) pertence a outra filial', p_tabela, p_id;
  END IF;
END;
$$;

CREATE TABLE public.fin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL,
  filial_id uuid,
  rpc text NOT NULL,
  canal text NOT NULL,
  ator_profile_id uuid,
  ator_user_id uuid,
  entidade text,
  entidade_id uuid,
  payload jsonb,
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Corpo REAL (supabase/migrations/20260710120000_fin_core_lancamentos.sql:234-260).
CREATE OR REPLACE FUNCTION public.fin_registrar_auditoria(
  p_ctx jsonb, p_rpc text, p_entidade text, p_entidade_id uuid,
  p_payload jsonb, p_resultado jsonb
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.fin_audit_log
    (igreja_id, filial_id, rpc, canal, ator_profile_id, ator_user_id,
     entidade, entidade_id, payload, resultado)
  VALUES
    ((p_ctx ->> 'igreja_id')::uuid,
     NULLIF(p_ctx ->> 'filial_id', '')::uuid,
     p_rpc,
     COALESCE(p_ctx ->> 'canal', 'desconhecido'),
     NULLIF(p_ctx ->> 'ator_profile_id', '')::uuid,
     NULLIF(p_ctx ->> 'ator_user_id', '')::uuid,
     p_entidade, p_entidade_id, p_payload, p_resultado);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_filial_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULL::uuid; $$;

-- ─── Tabelas mínimas (schema consolidado, colunas que as 2 RPCs tocam) ──

CREATE TABLE public.contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'bancaria',
  saldo_inicial DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_atual DECIMAL(15,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'saida',
  ativo BOOLEAN NOT NULL DEFAULT true,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subcategorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria_id UUID NOT NULL REFERENCES public.categorias_financeiras(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.centros_custo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bases_ministeriais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_pessoa TEXT NOT NULL DEFAULT 'juridica',
  ativo BOOLEAN NOT NULL DEFAULT true,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.formas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  igreja_id UUID REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transacoes_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  tipo_lancamento TEXT NOT NULL CHECK (tipo_lancamento IN ('unico','recorrente','parcelado')),
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  valor_liquido NUMERIC,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  data_competencia DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  subcategoria_id UUID REFERENCES public.subcategorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_custo(id),
  base_ministerial_id UUID REFERENCES public.bases_ministeriais(id),
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  forma_pagamento TEXT,
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  numero_parcela INTEGER,
  total_parcelas INTEGER,
  recorrencia TEXT,
  data_fim_recorrencia DATE,
  anexo_url TEXT,
  observacoes TEXT,
  lancado_por UUID,
  juros NUMERIC DEFAULT 0,
  multas NUMERIC DEFAULT 0,
  desconto NUMERIC DEFAULT 0,
  taxas_administrativas NUMERIC DEFAULT 0,
  pessoa_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sessao_id UUID REFERENCES public.sessoes_contagem(id),
  solicitacao_reembolso_id UUID REFERENCES public.solicitacoes_reembolso(id),
  origem_registro TEXT NOT NULL DEFAULT 'manual',
  lancamento_pai_id UUID,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  transferencia_id UUID,
  wamid TEXT,
  wamid_item_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transferencias_contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_origem_id UUID NOT NULL REFERENCES public.contas(id),
  conta_destino_id UUID NOT NULL REFERENCES public.contas(id),
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  data_transferencia DATE NOT NULL DEFAULT CURRENT_DATE,
  data_competencia DATE NOT NULL DEFAULT CURRENT_DATE,
  transacao_saida_id UUID REFERENCES public.transacoes_financeiras(id),
  transacao_entrada_id UUID REFERENCES public.transacoes_financeiras(id),
  observacoes TEXT, anexo_url TEXT,
  status TEXT NOT NULL DEFAULT 'executada',
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  criado_por UUID,
  sessao_id UUID REFERENCES public.atendimentos_bot(id),
  wamid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transferencias_contas_diferentes CHECK (conta_origem_id <> conta_destino_id)
);

-- ─── Carrega o schema/RPCs REAIS desta PR via \ir ───────────────────────
\ir ../migrations/20260902000000_fin_wamid_idempotencia_ledger.sql

-- ─── Fixtures ────────────────────────────────────────────────────────
INSERT INTO public.igrejas (id, nome) VALUES
  ('11111111-0000-4000-8000-000000000001', 'Igreja Teste'),
  ('99999999-0000-4000-8000-000000000009', 'Igreja Teste 2 (isolamento)');
INSERT INTO public.contas (id, nome, igreja_id) VALUES
  ('22222222-0000-4000-8000-000000000001', 'Conta A', '11111111-0000-4000-8000-000000000001'),
  ('22222222-0000-4000-8000-000000000002', 'Conta B', '11111111-0000-4000-8000-000000000001'),
  ('88888888-0000-4000-8000-000000000008', 'Conta Igreja 2', '99999999-0000-4000-8000-000000000009');
INSERT INTO public.categorias_financeiras (id, nome, tipo, igreja_id) VALUES
  ('33333333-0000-4000-8000-000000000001', 'Categoria Teste', 'saida', '11111111-0000-4000-8000-000000000001'),
  ('77777777-0000-4000-8000-000000000007', 'Categoria Igreja 2', 'saida', '99999999-0000-4000-8000-000000000009');
INSERT INTO public.formas_pagamento (id, nome, igreja_id) VALUES
  ('44444444-0000-4000-8000-000000000001', 'Transferência Bancária', '11111111-0000-4000-8000-000000000001');

-- ─── Cenário 1: fin_criar_lancamento SEM wamid — 2 chamadas = 2 rows (baseline, sem regressão) ──
DO $$
DECLARE v_r1 jsonb; v_r2 jsonb;
BEGIN
  v_r1 := public.fin_criar_lancamento('saida', 100, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Despesa 1', '33333333-0000-4000-8000-000000000001', '{}'::jsonb,
    '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  v_r2 := public.fin_criar_lancamento('saida', 100, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Despesa 1', '33333333-0000-4000-8000-000000000001', '{}'::jsonb,
    '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  IF (v_r1 ->> 'id') = (v_r2 ->> 'id') THEN
    RAISE EXCEPTION 'FAIL cenario 1: sem wamid, 2 chamadas deveriam criar 2 rows DIFERENTES (regressao de comportamento pre-existente)';
  END IF;
  RAISE NOTICE 'PASS cenario 1: sem wamid, comportamento identico ao anterior (2 rows distintas)';
END $$;

-- ─── Cenário 2: MESMO wamid+item_key, tipo unico — 2ª chamada recupera o MESMO id ──
DO $$
DECLARE v_r1 jsonb; v_r2 jsonb;
BEGIN
  v_r1 := public.fin_criar_lancamento('saida', 200, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Despesa wamid-1', '33333333-0000-4000-8000-000000000001',
    jsonb_build_object('wamid', 'wamid-A', 'item_key', '0'), '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  v_r2 := public.fin_criar_lancamento('saida', 200, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Despesa wamid-1', '33333333-0000-4000-8000-000000000001',
    jsonb_build_object('wamid', 'wamid-A', 'item_key', '0'), '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  IF (v_r1 ->> 'id') IS DISTINCT FROM (v_r2 ->> 'id') THEN
    RAISE EXCEPTION 'FAIL cenario 2: mesmo wamid+item_key deveria devolver o MESMO id (got % vs %)', v_r1->>'id', v_r2->>'id';
  END IF;
  IF (SELECT count(*) FROM public.transacoes_financeiras WHERE wamid = 'wamid-A') <> 1 THEN
    RAISE EXCEPTION 'FAIL cenario 2: deveria existir exatamente 1 row com wamid=wamid-A (duplicou)';
  END IF;
  RAISE NOTICE 'PASS cenario 2: retentativa do mesmo wamid+item_key nao duplica (idempotencia real)';

  -- Audit log: 1ª chamada NAO idempotente, 2ª (replay) marcada
  -- idempotente=true (achado real de /code-review local — sem isso,
  -- todo replay grava audit log como se fosse criação nova). Filtra por
  -- wamid=wamid-A no payload pra não contar as chamadas sem wamid do
  -- cenário 1 (mesmo rpc).
  IF (SELECT count(*) FROM public.fin_audit_log
      WHERE rpc = 'fin_criar_lancamento' AND (payload -> 'extras' ->> 'wamid') = 'wamid-A') <> 2 THEN
    RAISE EXCEPTION 'FAIL cenario 2b: deveriam existir 2 entradas de audit log com wamid=wamid-A (1 por chamada)';
  END IF;
  IF (SELECT count(*) FROM public.fin_audit_log
      WHERE rpc = 'fin_criar_lancamento' AND (payload -> 'extras' ->> 'wamid') = 'wamid-A'
        AND (payload ->> 'idempotente') = 'true') <> 1 THEN
    RAISE EXCEPTION 'FAIL cenario 2b: exatamente 1 entrada de audit log deveria estar marcada idempotente=true (a 2a chamada)';
  END IF;
  RAISE NOTICE 'PASS cenario 2b: audit log distingue criacao nova de replay idempotente';
END $$;

-- ─── Cenário 3: MESMO wamid, item_key DIFERENTE — 2 itens distintos do mesmo lote, ambos criados ──
DO $$
DECLARE v_r1 jsonb; v_r2 jsonb;
BEGIN
  v_r1 := public.fin_criar_lancamento('saida', 50, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Item 0', '33333333-0000-4000-8000-000000000001',
    jsonb_build_object('wamid', 'wamid-B', 'item_key', '0'), '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  v_r2 := public.fin_criar_lancamento('saida', 75, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Item 1', '33333333-0000-4000-8000-000000000001',
    jsonb_build_object('wamid', 'wamid-B', 'item_key', '1'), '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  IF (v_r1 ->> 'id') = (v_r2 ->> 'id') THEN
    RAISE EXCEPTION 'FAIL cenario 3: item_key diferente sob o mesmo wamid deveria criar 2 rows DISTINTAS (loop de itens do mesmo comprovante colidindo)';
  END IF;
  IF (SELECT count(*) FROM public.transacoes_financeiras WHERE wamid = 'wamid-B') <> 2 THEN
    RAISE EXCEPTION 'FAIL cenario 3: deveriam existir exatamente 2 rows com wamid=wamid-B';
  END IF;
  RAISE NOTICE 'PASS cenario 3: item_key diferente sob o mesmo wamid nao colide (loop de itens funciona)';
END $$;

-- ─── Cenário 4: PARCELADO (3 parcelas), retentativa do MESMO wamid+item_key recupera os 3 ids, sem duplicar ──
DO $$
DECLARE v_r1 jsonb; v_r2 jsonb;
BEGIN
  v_r1 := public.fin_criar_lancamento('saida', 300, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Parcelado', '33333333-0000-4000-8000-000000000001',
    jsonb_build_object('wamid', 'wamid-C', 'item_key', '0', 'tipo_lancamento', 'parcelado', 'total_parcelas', 3),
    '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  v_r2 := public.fin_criar_lancamento('saida', 300, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Parcelado', '33333333-0000-4000-8000-000000000001',
    jsonb_build_object('wamid', 'wamid-C', 'item_key', '0', 'tipo_lancamento', 'parcelado', 'total_parcelas', 3),
    '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  IF (v_r1 -> 'ids') IS DISTINCT FROM (v_r2 -> 'ids') THEN
    RAISE EXCEPTION 'FAIL cenario 4: retentativa do parcelado deveria devolver os MESMOS 3 ids (got % vs %)', v_r1->'ids', v_r2->'ids';
  END IF;
  IF (SELECT count(*) FROM public.transacoes_financeiras WHERE wamid = 'wamid-C') <> 3 THEN
    RAISE EXCEPTION 'FAIL cenario 4: deveriam existir exatamente 3 rows (as 3 parcelas), nao 6';
  END IF;
  RAISE NOTICE 'PASS cenario 4: parcelado nao duplica as parcelas numa retentativa (numero_parcela desempata dentro do item)';
END $$;

-- ─── Cenário 5: fin_criar_transferencia SEM wamid — 2 chamadas = 2 transferencias (baseline) ──
DO $$
DECLARE v_r1 jsonb; v_r2 jsonb;
BEGIN
  v_r1 := public.fin_criar_transferencia('22222222-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002',
    500, '2026-09-01', '{}'::jsonb, '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  v_r2 := public.fin_criar_transferencia('22222222-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002',
    500, '2026-09-01', '{}'::jsonb, '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  IF (v_r1 ->> 'id') = (v_r2 ->> 'id') THEN
    RAISE EXCEPTION 'FAIL cenario 5: sem wamid, 2 chamadas deveriam criar 2 transferencias DIFERENTES (regressao)';
  END IF;
  RAISE NOTICE 'PASS cenario 5: transferencia sem wamid, comportamento identico ao anterior';
END $$;

-- ─── Cenário 6: MESMO wamid — 2ª chamada de fin_criar_transferencia recupera o MESMO resultado, sem duplicar as 2 pernas ──
DO $$
DECLARE v_r1 jsonb; v_r2 jsonb; v_qtd_transf int; v_qtd_tx int;
BEGIN
  v_r1 := public.fin_criar_transferencia('22222222-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002',
    999, '2026-09-01', jsonb_build_object('wamid', 'wamid-T1'), '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  v_r2 := public.fin_criar_transferencia('22222222-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002',
    999, '2026-09-01', jsonb_build_object('wamid', 'wamid-T1'), '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  IF v_r1 IS DISTINCT FROM v_r2 THEN
    RAISE EXCEPTION 'FAIL cenario 6: retentativa do mesmo wamid deveria devolver o MESMO resultado completo (got % vs %)', v_r1, v_r2;
  END IF;
  SELECT count(*) INTO v_qtd_transf FROM public.transferencias_contas WHERE wamid = 'wamid-T1';
  SELECT count(*) INTO v_qtd_tx FROM public.transacoes_financeiras WHERE wamid = 'wamid-T1';
  IF v_qtd_transf <> 1 THEN
    RAISE EXCEPTION 'FAIL cenario 6: deveria existir exatamente 1 transferencia com wamid=wamid-T1 (achou %)', v_qtd_transf;
  END IF;
  IF v_qtd_tx <> 2 THEN
    RAISE EXCEPTION 'FAIL cenario 6: deveriam existir exatamente 2 pernas (saida+entrada) com wamid=wamid-T1 (achou %)', v_qtd_tx;
  END IF;
  RAISE NOTICE 'PASS cenario 6: retentativa da transferencia nao duplica nem a transferencia nem as 2 pernas';

  -- Audit log: achado real de /code-review local (2 ângulos
  -- independentes) — o early-return do replay pulava
  -- fin_registrar_auditoria; confirma que agora audita as 2 chamadas,
  -- a 2a marcada idempotente=true.
  IF (SELECT count(*) FROM public.fin_audit_log
      WHERE rpc = 'fin_criar_transferencia' AND (payload -> 'extras' ->> 'wamid') = 'wamid-T1') <> 2 THEN
    RAISE EXCEPTION 'FAIL cenario 6b: deveriam existir 2 entradas de audit log com wamid=wamid-T1 (1 por chamada) — early return do replay nao pode pular fin_registrar_auditoria';
  END IF;
  IF (SELECT count(*) FROM public.fin_audit_log
      WHERE rpc = 'fin_criar_transferencia' AND (payload -> 'extras' ->> 'wamid') = 'wamid-T1'
        AND (payload ->> 'idempotente') = 'true') <> 1 THEN
    RAISE EXCEPTION 'FAIL cenario 6b: exatamente 1 entrada de audit log deveria estar marcada idempotente=true';
  END IF;
  RAISE NOTICE 'PASS cenario 6b: audit log distingue criacao nova de replay idempotente (nao pula mais no early return)';
END $$;

-- ─── Cenário 7: as 2 pernas da MESMA transferência (saida/entrada) não colidem entre si sob o índice único de transacoes_financeiras ──
DO $$
DECLARE v_qtd int;
BEGIN
  SELECT count(DISTINCT wamid_item_key) INTO v_qtd FROM public.transacoes_financeiras WHERE wamid = 'wamid-T1';
  IF v_qtd <> 2 THEN
    RAISE EXCEPTION 'FAIL cenario 7: as 2 pernas deveriam ter wamid_item_key DIFERENTES (saida/entrada), achou % distintos', v_qtd;
  END IF;
  RAISE NOTICE 'PASS cenario 7: pernas saida/entrada da mesma transferencia coexistem sem colidir no indice unico';
END $$;

-- ─── Cenário 8: MESMO wamid sob 2 igrejas DIFERENTES não colide (achado real de /security-review local) ──
-- Sem igreja_id na chave, um wamid reusado/colidido sob outro tenant
-- recuperaria silenciosamente o id de OUTRA igreja em vez de criar uma
-- row nova (ou estourar FIN_INCONSISTENTE) — isolamento de tenant é
-- regra de ouro deste projeto (CLAUDE.md), testado explicitamente aqui.
DO $$
DECLARE v_r1 jsonb; v_r2 jsonb;
BEGIN
  v_r1 := public.fin_criar_lancamento('saida', 10, '2026-09-01', '22222222-0000-4000-8000-000000000001',
    'Igreja 1', '33333333-0000-4000-8000-000000000001',
    jsonb_build_object('wamid', 'wamid-CROSS', 'item_key', '0'),
    '{"igreja_id": "11111111-0000-4000-8000-000000000001", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  v_r2 := public.fin_criar_lancamento('saida', 20, '2026-09-01', '88888888-0000-4000-8000-000000000008',
    'Igreja 2', '77777777-0000-4000-8000-000000000007',
    jsonb_build_object('wamid', 'wamid-CROSS', 'item_key', '0'),
    '{"igreja_id": "99999999-0000-4000-8000-000000000009", "ator_profile_id": null, "canal": "bot"}'::jsonb);
  IF (v_r1 ->> 'id') = (v_r2 ->> 'id') THEN
    RAISE EXCEPTION 'FAIL cenario 8: mesmo wamid+item_key sob IGREJAS DIFERENTES nao deveria colidir/recuperar o id de outro tenant (vazamento cross-tenant)';
  END IF;
  IF (SELECT count(*) FROM public.transacoes_financeiras WHERE wamid = 'wamid-CROSS') <> 2 THEN
    RAISE EXCEPTION 'FAIL cenario 8: deveriam existir 2 rows distintas (1 por igreja) com wamid=wamid-CROSS';
  END IF;
  IF (SELECT igreja_id FROM public.transacoes_financeiras WHERE id = (v_r2 ->> 'id')::uuid)
       <> '99999999-0000-4000-8000-000000000009'::uuid THEN
    RAISE EXCEPTION 'FAIL cenario 8: a row recuperada/criada pra igreja 2 deveria pertencer a igreja 2';
  END IF;
  RAISE NOTICE 'PASS cenario 8: mesmo wamid sob igrejas diferentes NAO colide (isolamento de tenant preservado)';
END $$;

-- Cleanup: TRUNCATE em cascata cobre tudo (banco descartável, mas por
-- completude caso alguém rode isso num Postgres persistente por engano).
TRUNCATE public.transacoes_financeiras, public.transferencias_contas,
  public.contas, public.categorias_financeiras, public.formas_pagamento,
  public.fin_audit_log, public.igrejas CASCADE;

\echo 'fin_wamid_idempotencia_test.sql: TODOS OS CENARIOS PASSARAM'
