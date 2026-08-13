-- ============================================================================
-- Cria o bucket `getnet-raw-files` que faltou na migration original
-- (20260603221203) — aquela migration só criou a policy de SELECT sobre
-- `storage.objects`, nunca o bucket em si (`INSERT INTO storage.buckets`).
--
-- Achado ao investigar por que o cron `getnet-sync-automatico` nunca
-- funcionou: além do GUC `app.settings.*` faltando (corrigido fora desta
-- migration, é config de ambiente, não schema), o pipeline também tentaria
-- falhar aqui — `supabaseAdmin.storage.from("getnet-raw-files").upload(...)`
-- (getnet-sftp/index.ts) não tem bucket nenhum pra escrever.
--
-- Privado (guardrail: dado financeiro do extrato Getnet) — a policy de
-- SELECT já existente (`getnet_raw_files_select_admins`) só libera leitura
-- pra admin/tesoureiro da própria igreja, via prefixo do path
-- (`igreja_id/integracao_id/data/arquivo`). Sem policy de INSERT pra
-- `authenticated` — só `service_role` (edge function) escreve.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('getnet-raw-files', 'getnet-raw-files', false, 5242880, ARRAY['text/plain'])
ON CONFLICT (id) DO NOTHING;
