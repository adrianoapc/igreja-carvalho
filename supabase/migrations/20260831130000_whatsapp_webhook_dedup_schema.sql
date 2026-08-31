-- ADR-033 / PR1 do fatiamento em PRs empilhadas (docs/automacoes/
-- PLANO_REMOCAO_MAKE_WHATSAPP.md §Fatiamento em PRs empilhadas).
--
-- Schema só, dark: nenhuma function ainda escreve ou lê estas tabelas.
-- Base pra 2 mecanismos de concorrência distintos que a whatsapp-webhook
-- (PR3+) vai precisar — ver ADR-033 Decisão 7 e §Consequências:
--   1. Dedup/lease por `wamid` (message_id da Meta) — máquina de estado
--      queued → processing → chatbot_done → completed, com fencing por
--      owner_token. A mesma tabela também serve de fila FIFO por
--      conversa: cada row carrega a chave da conversa + ordem de chegada
--      (meta_timestamp/seq), então "achar a cabeça da fila" é uma query
--      nesta tabela, não uma tabela separada.
--   2. Lock de conversa (serialização de mensagens diferentes da MESMA
--      conversa, eixo ortogonal ao dedup por wamid) — 1 row persistente
--      por conversa, `owner_token IS NULL` = livre.
--
-- Acesso: só service_role, de dentro da própria function (orquestrador).
-- RLS habilitada com policies USING(false)/WITH CHECK(false) explícitas
-- pras 4 ações, TO authenticated — mesmo padrão de
-- integracoes_financeiras_secrets (20260115140708), não "zero policies".
-- service_role ignora RLS de qualquer forma (continua funcionando pra
-- function); a diferença é que uma policy futura adicionada sem querer
-- não destranca nada por omissão — pra abrir acesso, alguém precisaria
-- remover/alterar uma policy `false` explícita, visível no grep e no
-- diff, em vez de só adicionar uma nova policy numa tabela hoje sem
-- nenhuma. Mesmo racional do vazamento cross-tenant fechado em
-- edge_function_logs (PR0) — estas tabelas carregam telefone + conteúdo
-- completo de mensagem/resposta em `request_payload`/`chatbot_result`,
-- ninguém deveria navegar por elas via UI.
--
-- Sem FK pra igrejas/filiais/whatsapp_numeros de propósito: são
-- metadados de roteamento/fila opacos ao orquestrador, não dados de
-- negócio — uma igreja/filial podendo ser removida no meio de uma
-- mensagem em trânsito não deveria falhar por violação de FK numa
-- tabela de fila interna.

CREATE TABLE public.whatsapp_wamid_dedup (
  wamid TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'chatbot_done', 'completed')),
  owner_token UUID NOT NULL,
  lease_until TIMESTAMP WITH TIME ZONE NOT NULL,
  chatbot_result JSONB,
  request_payload JSONB NOT NULL,
  igreja_id UUID,
  filial_id UUID,
  phone_number_id TEXT NOT NULL,
  telefone TEXT NOT NULL,
  meta_timestamp BIGINT NOT NULL,
  -- IDENTITY, não DEFAULT 0: precisa ser um desempate durável e
  -- atomicamente único mesmo sob 2 enqueues concorrentes da mesma
  -- conversa (2 mensagens no mesmo segundo de meta_timestamp) — um
  -- DEFAULT constante deixaria a garantia de unicidade a cargo de quem
  -- chama o INSERT, exatamente a corrida que esta coluna existe pra
  -- fechar (ADR-033 §Passo 1, achado @codex review 11ª rodada).
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.whatsapp_wamid_dedup TO service_role;

COMMENT ON TABLE public.whatsapp_wamid_dedup IS
  'Dedup/lease por wamid (message_id da Meta) da whatsapp-webhook (ADR-033). '
  'Também serve de fila FIFO por conversa (phone_number_id+telefone+igreja_id'
  '+filial_id), ordenada por meta_timestamp/seq. Service_role-only — RLS '
  'com policies USING(false) explícitas pra authenticated, sem acesso '
  'nenhum via PostgREST.';
COMMENT ON COLUMN public.whatsapp_wamid_dedup.owner_token IS
  'UUID da tentativa dona da vez (fencing). Só quem tem o token corrente '
  'pode avançar o estado enquanto status=processing.';
COMMENT ON COLUMN public.whatsapp_wamid_dedup.chatbot_result IS
  'Lista de entregas Graph (ex.: [{alvo,payload,status}]) — não um '
  'resultado único; notificar_admin gera >1 entrega por wamid.';
COMMENT ON COLUMN public.whatsapp_wamid_dedup.meta_timestamp IS
  'Epoch (segundos) de value.messages[].timestamp da Meta — ordena a '
  'FIFO da conversa; seq desempata mensagens no mesmo segundo.';

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_wamid_dedup_updated_at
BEFORE UPDATE ON public.whatsapp_wamid_dedup
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Query de dequeue: "cabeça da fila desta conversa, mais antiga primeiro".
CREATE INDEX idx_whatsapp_wamid_dedup_fifo
ON public.whatsapp_wamid_dedup
  (phone_number_id, telefone, igreja_id, filial_id, status, meta_timestamp, seq);

-- Sweep do job de reclaim (PR7): só queued/processing com lease
-- expirado — chatbot_done/completed nunca precisam de reclaim. Os
-- estados por item de entrega (pendente/enviando/enviado/falhou/
-- erro_credencial) vivem dentro do JSONB chatbot_result, não nesta
-- coluna status; enviando/erro_credencial ficam de fora do sweep por
-- design (reconciliação manual, ver ADR-033), mas isso é decidido na
-- lógica da function, não filtrável aqui — esta coluna nunca assume
-- esses valores.
CREATE INDEX idx_whatsapp_wamid_dedup_lease_sweep
ON public.whatsapp_wamid_dedup (status, lease_until)
WHERE status IN ('queued', 'processing');

ALTER TABLE public.whatsapp_wamid_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only - no direct select"
ON public.whatsapp_wamid_dedup FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "Service role only - no direct insert"
ON public.whatsapp_wamid_dedup FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Service role only - no direct update"
ON public.whatsapp_wamid_dedup FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Service role only - no direct delete"
ON public.whatsapp_wamid_dedup FOR DELETE
TO authenticated
USING (false);

CREATE TABLE public.whatsapp_conversa_lock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID,
  filial_id UUID,
  phone_number_id TEXT NOT NULL,
  telefone TEXT NOT NULL,
  owner_token UUID,
  lease_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- igreja_id/filial_id são nullable de verdade (whatsapp_numeros aceita
  -- NULL = recurso global/compartilhado, ver CLAUDE.md §Filial
  -- compartilhada) — NULLS NOT DISTINCT evita que 2 mensagens da mesma
  -- conversa num número com filial nula criem 2 rows de lock "únicas"
  -- (achado real de @codex review, ADR-033 §Passo 1, 22ª/26ª rodada).
  CONSTRAINT whatsapp_conversa_lock_key
    UNIQUE NULLS NOT DISTINCT (igreja_id, filial_id, phone_number_id, telefone),
  -- Livre = os 2 nulos; ocupado = os 2 preenchidos — nunca só um. Sem
  -- isso, um bug de release que zera owner_token mas esquece
  -- lease_until (ou acquire em 2 statements fora de transaction)
  -- deixaria a regra de reclaim (owner_token IS NOT NULL AND
  -- lease_until < now()) incapaz de reconhecer a row como reclamável,
  -- travando a conversa pra sempre.
  CONSTRAINT whatsapp_conversa_lock_owner_lease_together
    CHECK ((owner_token IS NULL) = (lease_until IS NULL))
);

GRANT ALL ON public.whatsapp_conversa_lock TO service_role;

COMMENT ON TABLE public.whatsapp_conversa_lock IS
  'Lock de conversa da whatsapp-webhook (ADR-033) — serializa mensagens '
  'DIFERENTES (wamid distintos) da mesma conversa, eixo ortogonal ao '
  'dedup por wamid em whatsapp_wamid_dedup. Row persiste indefinidamente '
  'após o 1º touch da conversa; owner_token IS NULL = livre. '
  'Service_role-only — RLS com policies USING(false) explícitas pra '
  'authenticated, sem acesso nenhum via PostgREST.';
COMMENT ON COLUMN public.whatsapp_conversa_lock.owner_token IS
  'NULL = lock livre. Liberado (owner_token=NULL, lease_until=NULL) '
  'assim que o wamid corrente atinge chatbot_done — não precisa esperar '
  'completed.';

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_conversa_lock_updated_at
BEFORE UPDATE ON public.whatsapp_conversa_lock
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.whatsapp_conversa_lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only - no direct select"
ON public.whatsapp_conversa_lock FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "Service role only - no direct insert"
ON public.whatsapp_conversa_lock FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Service role only - no direct update"
ON public.whatsapp_conversa_lock FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Service role only - no direct delete"
ON public.whatsapp_conversa_lock FOR DELETE
TO authenticated
USING (false);
