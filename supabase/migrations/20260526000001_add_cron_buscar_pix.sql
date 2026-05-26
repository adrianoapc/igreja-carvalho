-- Migration: Adicionar cron para buscar PIX automaticamente via API Santander
-- Data: 2026-05-26
-- Descrição: 
--   - Roda a cada 1 hora a Edge Function buscar-pix-cron
--   - Usa lógica de calcularJanelaSincronizacao (última sessão finalizada + 1s até agora)
--   - Insere PIX recebidos na tabela pix_webhook_temp para processamento

-- Habilitar extensão pg_cron se ainda não estiver habilitada
create extension if not exists pg_cron;

-- Criar job que roda a cada 1 hora
select cron.schedule(
  'buscar-pix-automatico',           -- nome do job
  '0 * * * *',                        -- cron expression: a cada hora no minuto 0
  $$
    select
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/buscar-pix-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      ) as request_id;
  $$
);

-- Comentário explicativo
comment on extension pg_cron is 'Extensão para agendar jobs periódicos no PostgreSQL';

-- Log da criação do cron
insert into public.edge_function_logs (function_name, status, details)
values ('buscar-pix-cron', 'info', 'Cron job configurado para rodar a cada 1 hora')
on conflict do nothing;
