-- ============================================================================
-- Corrige os 2 cron jobs que chamam edge functions via net.http_post
-- (getnet-sync-automatico, buscar-pix-automatico) — os dois dependiam de
-- `current_setting('app.settings.supabase_url'/'app.settings.
-- service_role_key')`, um GUC customizado que NUNCA existiu neste projeto.
--
-- Achado durante investigação da C2-9 (spike EDI, precisava de dado real
-- de produção pra comparar nsu_cv): getnet_analitico/getnet_resumo/
-- getnet_financeiro_resumo/getnet_financeiro_detalhe/getnet_arquivos
-- estavam TODAS zeradas em produção. Confirmado em `cron.job_run_details`:
-- os 2 jobs falham 100% das vezes desde a criação
-- (`ERROR: unrecognized configuration parameter "app.settings.
-- supabase_url"`) — getnet-sync-automatico desde 2026-06-21 (45/45
-- falhas), buscar-pix-automatico desde a mesma data (1073/1073 falhas).
--
-- Causa raiz: `ALTER DATABASE ... SET app.settings.x` (o padrão de
-- tutoriais antigos do Supabase) e `ALTER ROLE ... SET app.settings.x`
-- retornam `permission denied to set parameter` em projetos Supabase
-- gerenciados — GUC customizado não é mais permitido por esse caminho.
-- O "Custom Postgres Config" do dashboard/CLI (`postgres-config update`)
-- também não aceita: só reconhece parâmetros reais do `postgresql.conf`
-- (`max_connections`, `statement_timeout` etc.), não chaves arbitrárias
-- `app.settings.*`.
--
-- Fix: Supabase Vault (extensão `supabase_vault`, já habilitada) é o
-- mecanismo suportado pra secret acessível de dentro do Postgres. O valor
-- real da secret (`cron_service_role_key`) foi criado DIRETO em produção
-- via `vault.create_secret(...)` fora desta migration — nunca commitado
-- em texto puro no git, mesmo racional de nunca commitar a
-- SUPABASE_SERVICE_ROLE_KEY em lugar nenhum do repo. Esta migration só
-- reaponta os 2 jobs pra consultar `vault.decrypted_secrets` pelo nome —
-- reaplicá-la sem a secret existente faz os jobs voltarem a falhar (agora
-- com "no rows" em vez do erro de GUC), não silenciosamente "funcionar
-- sem auth".
--
-- A URL do projeto não é secreta (é pública, qualquer cliente já conhece)
-- — hardcoded direto no comando em vez de outro nível de indireção.
--
-- `timeout_milliseconds` explícito (120s, default do net.http_post é só
-- 5000ms): confirmado no harness manual (net._http_response.error_msg)
-- que uma sincronização real (SFTP connect + download + parse + upsert
-- em várias tabelas por arquivo) passa fácil dos 5s — sem isso, mesmo
-- com auth/bucket corrigidos, o cron continuaria "falhando" (timeout do
-- lado do Postgres) enquanto a edge function processava no servidor.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'getnet-sync-automatico';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(
      v_jobid,
      command := $cmd$
        select net.http_post(
          url := 'https://ugnrumtngcskbfpwynsr.supabase.co/functions/v1/getnet-sftp',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              select decrypted_secret from vault.decrypted_secrets
              where name = 'cron_service_role_key'
            )
          ),
          body := jsonb_build_object(
            'action', 'sync',
            'integracao_id', id::text,
            'batch_size', 14
          ),
          timeout_milliseconds := 120000
        ) as request_id
        from public.integracoes_financeiras
        where provedor = 'getnet'
          and tipo_auth = 'sftp'
          and status = 'ativo';
      $cmd$
    );
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'buscar-pix-automatico';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(
      v_jobid,
      command := $cmd$
        select net.http_post(
          url := 'https://ugnrumtngcskbfpwynsr.supabase.co/functions/v1/buscar-pix-cron',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              select decrypted_secret from vault.decrypted_secrets
              where name = 'cron_service_role_key'
            )
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 120000
        ) as request_id;
      $cmd$
    );
  END IF;
END $$;
