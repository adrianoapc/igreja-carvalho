-- ADR-033 / PR2a-1 do fatiamento em PRs empilhadas (docs/automacoes/
-- PLANO_REMOCAO_MAKE_WHATSAPP.md §Fatiamento em PRs empilhadas, §Passo 1
-- item de idempotência #5 — "registro append-only por wamid, não campo
-- na sessão mutável", "claim no INÍCIO da function", "mesmo fencing do
-- claim externo, não 'existe = já processado'").
--
-- Registro interno de idempotência de ENTRADA de chatbot-triagem/
-- chatbot-financeiro por wamid — separado do dedup/lease do
-- orquestrador (whatsapp_wamid_dedup, PR1): aquele tabela ainda não tem
-- nenhum caller (a whatsapp-webhook em si só existe como schema, ver
-- PR1) — hoje esta é a ÚNICA camada de proteção quando `wamid` vier no
-- body, não uma de duas. Este registro decide se O PRÓPRIO chatbot,
-- chamado 2x com o mesmo wamid (redelivery da Meta via Make hoje, ou
-- reclaim do orquestrador quando ele existir), reprocessa do zero ou
-- devolve a resposta já computada.
--
-- Aditivo/dark: só passa a valer quando o caller manda `wamid` no body
-- (nenhum caller manda hoje — Make não envia esse campo). PR2a-2
-- (separada) propaga wamid pras RPCs fin_criar_lancamento/
-- fin_criar_transferencia para guarda de unicidade no ledger — fora do
-- escopo desta migration.

CREATE TABLE public.whatsapp_chatbot_wamid_claim (
  wamid TEXT NOT NULL,
  chatbot TEXT NOT NULL CHECK (chatbot IN ('triagem', 'financeiro')),
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed')),
  owner_token UUID NOT NULL,
  -- Fim do lease de processing OU da janela de cache de completed —
  -- ver claim_whatsapp_chatbot_wamid: QUALQUER status com lease_until
  -- vencido é reclamável, não só processing. completed não é "pra
  -- sempre" (achado real de /code-review local: uma resposta 200 que é
  -- na verdade uma falha de negócio — timeout de IA com erro_ia:true,
  -- "erro ao salvar comprovante, tente de novo" — ficaria presa sendo
  -- reservida indefinidamente num design sem TTL, impedindo a própria
  -- retentativa que esses fallbacks foram desenhados pra permitir).
  lease_until TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Vincula o claim a QUEM mandou a mensagem original — ver
  -- claim_whatsapp_chatbot_wamid: um replay do mesmo wamid só recebe a
  -- resposta cacheada se o telefone bater (achado real de
  -- /security-review local: nenhum dos 2 chatbots valida QUEM está
  -- pedindo o replay além de wamid — chatbot-triagem não tem gate de
  -- segredo nenhum hoje [ADR-033 bug conhecido #2, fechado só na PR2b];
  -- sem esse vínculo, quem descobrisse/reusasse um wamid alheio
  -- receberia a resposta pastoral/financeira de outra pessoa em cache,
  -- sem precisar reautenticar nem provar que é o mesmo remetente).
  telefone TEXT NOT NULL,
  response_payload JSONB,
  response_status INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (wamid, chatbot)
);

GRANT ALL ON public.whatsapp_chatbot_wamid_claim TO service_role;

COMMENT ON TABLE public.whatsapp_chatbot_wamid_claim IS
  'Idempotência de ENTRADA por wamid, própria de cada chatbot (ADR-033) — '
  'não confundir com whatsapp_wamid_dedup (PR1), que é schema do '
  'orquestrador ainda sem caller nenhum. status=completed cacheia a '
  'resposta pra replay só até lease_until (janela de cache, não pra '
  'sempre); qualquer status com lease_until vencido é reclamável. '
  'Service_role-only.';
COMMENT ON COLUMN public.whatsapp_chatbot_wamid_claim.owner_token IS
  'Fencing: só quem tem o token corrente marca completed/release (via '
  'complete_whatsapp_chatbot_wamid/release_whatsapp_chatbot_wamid). '
  'Reclamar uma row com lease/janela vencida gera um owner_token novo.';
COMMENT ON COLUMN public.whatsapp_chatbot_wamid_claim.response_payload IS
  'Corpo da resposta HTTP já computada, cacheada pra devolver em replay '
  'sem reprocessar (evita reabrir sessão/duplicar pedido pastoral/etc.) '
  'até lease_until — só populado quando a resposta foi HTTP < 400 '
  '(ver release_whatsapp_chatbot_wamid pro caminho de erro/exceção).';

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_chatbot_wamid_claim_updated_at
BEFORE UPDATE ON public.whatsapp_chatbot_wamid_claim
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Sweep/observabilidade futura (não usado nesta PR, mas barato de já
-- ter) — cobre os 2 status já que ambos usam lease_until como prazo.
CREATE INDEX idx_whatsapp_chatbot_wamid_claim_lease
ON public.whatsapp_chatbot_wamid_claim (lease_until);

ALTER TABLE public.whatsapp_chatbot_wamid_claim ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de integracoes_financeiras_secrets/otp_verificacao: RLS
-- com policies USING(false)/WITH CHECK(false) explícitas, não "zero
-- policies" (ver PR1 pro racional completo — uma policy futura
-- adicionada sem querer não destranca nada por omissão).
CREATE POLICY "Service role only - no direct select"
ON public.whatsapp_chatbot_wamid_claim FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "Service role only - no direct insert"
ON public.whatsapp_chatbot_wamid_claim FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Service role only - no direct update"
ON public.whatsapp_chatbot_wamid_claim FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Service role only - no direct delete"
ON public.whatsapp_chatbot_wamid_claim FOR DELETE
TO authenticated
USING (false);

-- Claim atômico: insere novo, ou reclama QUALQUER row (processing OU
-- completed) cuja lease_until já venceu — reseta status pra
-- 'processing' e limpa a resposta cacheada de uma tentativa anterior,
-- porque estamos processando de novo do zero (mesmo owner_token
-- vencedor nos 2 casos, e o telefone da tentativa nova substitui o da
-- tentativa antiga). Se não conseguir nem inserir nem reclamar (row
-- existe e não está livre), devolve o estado ATUAL da row (dono antigo)
-- pra quem chamou decidir: completed → devolve resposta cacheada SÓ SE
-- telefone_match; processing com lease válido → 409 (processamento
-- genuíno em andamento).
--
-- owned=true nos 2 casos "eu ganhei" (insert novo OU reclaim); owned=
-- false quando outra invocação segue dona. telefone_match=false num hit
-- completed é sinal de replay com wamid de outra conversa — o caller
-- NUNCA deve servir response_payload nesse caso (ver comentário na
-- coluna telefone). Não SECURITY DEFINER: só service_role chama isso
-- (já bypassa RLS na tabela via BYPASSRLS), não precisa de
-- escalonamento de privilégio.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_chatbot_wamid(
  p_wamid TEXT,
  p_chatbot TEXT,
  p_owner_token UUID,
  p_telefone TEXT,
  p_lease_seconds INTEGER DEFAULT 150
)
RETURNS TABLE (
  owned BOOLEAN,
  status TEXT,
  telefone_match BOOLEAN,
  response_payload JSONB,
  response_status INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_lease_seconds IS NULL OR p_lease_seconds <= 0 THEN
    RAISE EXCEPTION 'p_lease_seconds precisa ser positivo (recebido: %)', p_lease_seconds;
  END IF;

  INSERT INTO public.whatsapp_chatbot_wamid_claim
    (wamid, chatbot, status, owner_token, lease_until, telefone)
  VALUES
    (p_wamid, p_chatbot, 'processing', p_owner_token,
     now() + make_interval(secs => p_lease_seconds), p_telefone)
  ON CONFLICT (wamid, chatbot) DO UPDATE
    SET status = 'processing',
        owner_token = EXCLUDED.owner_token,
        lease_until = EXCLUDED.lease_until,
        telefone = EXCLUDED.telefone,
        response_payload = NULL,
        response_status = NULL,
        updated_at = now()
    WHERE public.whatsapp_chatbot_wamid_claim.lease_until < now();

  -- response_payload/response_status só voltam quando o telefone bate —
  -- suprimidos (NULL) em qualquer mismatch, pra um bug futuro no código
  -- TS caller (esquecer de checar telefone_match) não conseguir vazar a
  -- resposta cacheada de outra conversa mesmo sem querer.
  RETURN QUERY
  SELECT
    (c.owner_token = p_owner_token) AS owned,
    c.status,
    (c.telefone = p_telefone) AS telefone_match,
    CASE WHEN c.telefone = p_telefone THEN c.response_payload ELSE NULL END,
    CASE WHEN c.telefone = p_telefone THEN c.response_status ELSE NULL END
  FROM public.whatsapp_chatbot_wamid_claim c
  WHERE c.wamid = p_wamid AND c.chatbot = p_chatbot;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_whatsapp_chatbot_wamid(TEXT, TEXT, UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_chatbot_wamid(TEXT, TEXT, UUID, TEXT, INTEGER) TO service_role;

-- Marca completed só se ainda formos o dono (fencing) — se outra
-- invocação já reclamou uma lease/janela vencida no meio do caminho,
-- esta chamada é no-op (retorna false) em vez de sobrescrever o dono
-- novo. lease_until vira a janela de cache (default 1h) — não "pra
-- sempre": uma resposta HTTP >= 400 nunca deveria chegar aqui (ver
-- release_whatsapp_chatbot_wamid), mas mesmo uma resposta 200
-- genuinamente ruim (fallback de falha de IA, "tente reenviar o
-- comprovante") só fica presa cacheada por até 1h, não indefinidamente.
CREATE OR REPLACE FUNCTION public.complete_whatsapp_chatbot_wamid(
  p_wamid TEXT,
  p_chatbot TEXT,
  p_owner_token UUID,
  p_response_payload JSONB,
  p_response_status INTEGER,
  p_cache_seconds INTEGER DEFAULT 3600
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_cache_seconds IS NULL OR p_cache_seconds <= 0 THEN
    RAISE EXCEPTION 'p_cache_seconds precisa ser positivo (recebido: %)', p_cache_seconds;
  END IF;

  UPDATE public.whatsapp_chatbot_wamid_claim
  SET status = 'completed',
      response_payload = p_response_payload,
      response_status = p_response_status,
      lease_until = now() + make_interval(secs => p_cache_seconds),
      updated_at = now()
  WHERE wamid = p_wamid AND chatbot = p_chatbot AND owner_token = p_owner_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_whatsapp_chatbot_wamid(TEXT, TEXT, UUID, JSONB, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_whatsapp_chatbot_wamid(TEXT, TEXT, UUID, JSONB, INTEGER, INTEGER) TO service_role;

-- Libera o claim IMEDIATAMENTE (lease_until=now(), status continua
-- processing) — usado quando o processamento lança exceção ou devolve
-- HTTP >= 400: nem sucesso pra cachear, nem "ainda processando" de
-- verdade. Sem isso, a row ficaria processing com a lease de 150s
-- inteira ainda válida, e um redelivery LEGÍTIMO da Meta levaria 409
-- em vez de reprocessar (achado real de /code-review local — 2 ângulos
-- independentes acharam o mesmo buraco). Fenced por owner_token: se
-- outra invocação já reclamou a row, este release é no-op.
CREATE OR REPLACE FUNCTION public.release_whatsapp_chatbot_wamid(
  p_wamid TEXT,
  p_chatbot TEXT,
  p_owner_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.whatsapp_chatbot_wamid_claim
  SET lease_until = now(),
      updated_at = now()
  WHERE wamid = p_wamid AND chatbot = p_chatbot AND owner_token = p_owner_token
    AND status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_whatsapp_chatbot_wamid(TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_whatsapp_chatbot_wamid(TEXT, TEXT, UUID) TO service_role;
