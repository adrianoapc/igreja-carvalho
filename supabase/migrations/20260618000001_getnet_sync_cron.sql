-- =============================================================================
-- Getnet Sync Cron — importa automaticamente arquivos pendentes do SFTP
-- Roda diariamente às 10:00 UTC (07:00 BRT) via pg_cron + net.http_post.
-- Itera sobre todas as integrações Getnet SFTP ativas da instância.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove job antigo se existir (idempotente)
select cron.unschedule('getnet-sync-automatico') where exists (
  select 1 from cron.job where jobname = 'getnet-sync-automatico'
);

select cron.schedule(
  'getnet-sync-automatico',
  '0 10 * * *',
  $$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/getnet-sftp',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'action', 'sync',
        'integracao_id', id::text,
        'batch_size', 14
      )
    ) as request_id
    from public.integracoes_financeiras
    where provedor = 'getnet'
      and tipo_auth = 'sftp'
      and status = 'ativo';
  $$
);
