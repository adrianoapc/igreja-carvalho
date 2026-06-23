-- =====================================================================
-- Pedidos de Oração — Expurgo automático (LGPD art. 15 e 16)
-- Prazo de retenção: 12 meses após created_at
--   confidencial = true  → EXCLUSÃO física (sem rastro residual)
--   confidencial = false → ANONIMIZAÇÃO (preserva dado agregado para estatística)
-- =====================================================================

-- Função de expurgo (SECURITY DEFINER para bypass de RLS)
-- O cron job não tem sessão autenticada; SECURITY DEFINER permite que a
-- função opere com os privilégios do owner (superuser no Supabase), contornando
-- as políticas RLS que bloqueariam DELETE/UPDATE do role padrão.
CREATE OR REPLACE FUNCTION public.expurgar_pedidos_oracao()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prazo        CONSTANT INTERVAL := INTERVAL '12 months';
  v_deletados    INTEGER;
  v_anonimizados INTEGER;
BEGIN
  -- ── Passo 1: Excluir registros confidenciais vencidos ─────────────
  -- LGPD art. 16: nenhum dado residual — exclusão física da linha inteira.
  -- Não há anonimização porque o pedido foi explicitamente marcado como
  -- sensível pelo titular; manter até dado agregado seria violação do espírito
  -- do consentimento restrito.
  DELETE FROM public.pedidos_oracao
  WHERE  confidencial = true
    AND  created_at   < now() - v_prazo;
  GET DIAGNOSTICS v_deletados = ROW_COUNT;

  -- ── Passo 2: Anonimizar registros não-confidenciais vencidos ──────
  -- LGPD art. 12: dado anonimizado não é dado pessoal → pode ser retido
  -- para estatísticas ministeriais (contagem por tipo, origem, período).
  --
  -- Colunas PRESERVADAS (não identificam o titular):
  --   id, tipo, status='arquivado', origem, classificacao,
  --   created_at, data_alocacao, data_resposta, intercessor_id,
  --   igreja_id, filial_id, analise_ia_gravidade (grau de severidade, sem PII)
  --
  -- Colunas ZERADAS (PII ou conteúdo que identifica):
  --   nome_solicitante, email_solicitante, telefone_solicitante,
  --   pedido, texto_na_integra, observacoes_intercessor,
  --   analise_ia_titulo, analise_ia_motivo, analise_ia_resposta,
  --   membro_id, pessoa_id, visitante_id, consentimento_em
  --
  -- anonimo = true: consistente com a semântica já usada no app
  --   (PedidoDetailsDialog exibe "Anônimo" quando anonimo=true)
  UPDATE public.pedidos_oracao
  SET
    nome_solicitante        = '[EXPURGADO]',
    email_solicitante       = NULL,
    telefone_solicitante    = NULL,
    pedido                  = '[conteúdo removido — LGPD retenção 12 meses]',
    texto_na_integra        = NULL,
    observacoes_intercessor = NULL,
    analise_ia_titulo       = NULL,
    analise_ia_motivo       = NULL,
    analise_ia_resposta     = NULL,
    membro_id               = NULL,
    pessoa_id               = NULL,
    visitante_id            = NULL,
    consentimento_em        = NULL,
    anonimo                 = true,
    status                  = 'arquivado',
    updated_at              = now()
  WHERE  confidencial = false
    AND  created_at   < now() - v_prazo
    -- Cláusula idempotente: não re-processa linhas já expurgadas
    AND  (status <> 'arquivado' OR nome_solicitante <> '[EXPURGADO]');
  GET DIAGNOSTICS v_anonimizados = ROW_COUNT;

  RAISE NOTICE
    '[LGPD expurgo] excluídos (confidenciais): %, anonimizados: % (prazo: 12 meses)',
    v_deletados, v_anonimizados;
END;
$$;

COMMENT ON FUNCTION public.expurgar_pedidos_oracao() IS
  'LGPD art. 15–16: remove PII de pedidos com mais de 12 meses. '
  'confidencial=true → exclusão física. confidencial=false → anonimização. '
  'SECURITY DEFINER: opera além do RLS. '
  'Agendado via pg_cron toda segunda-feira às 03:00 UTC (00:00 BRT).';

-- ── Agendamento via pg_cron ───────────────────────────────────────────
-- Disponível no Supabase Pro+. Se o DO block emitir WARNING, crie um
-- Scheduled Edge Function no Dashboard (Settings → Edge Functions → Schedule)
-- que chame: supabase.rpc('expurgar_pedidos_oracao') com a service_role key.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove agendamento anterior (idempotente)
    BEGIN
      PERFORM cron.unschedule('expurgo-pedidos-oracao');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- job ainda não existia
    END;

    PERFORM cron.schedule(
      'expurgo-pedidos-oracao',
      '0 3 * * 1',   -- toda segunda-feira às 03:00 UTC (00:00 BRT)
      $cron$SELECT public.expurgar_pedidos_oracao()$cron$
    );

    RAISE NOTICE
      'pg_cron: job "expurgo-pedidos-oracao" agendado (toda seg 03:00 UTC / 00:00 BRT).';
  ELSE
    RAISE WARNING
      'pg_cron não disponível neste projeto (requer Supabase Pro+). '
      'Crie um Scheduled Edge Function para chamar expurgar_pedidos_oracao() semanalmente.';
  END IF;
END $$;
