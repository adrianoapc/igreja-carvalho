-- Fix: Expand integracoes_execucoes_log.acao CHECK constraint
-- to include 'sync' and 'import_extrato_arquivo' used by getnet-sftp edge function.

DO $$
DECLARE
  v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.integracoes_execucoes_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%acao%';
  IF v_con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.integracoes_execucoes_log DROP CONSTRAINT ' || quote_ident(v_con);
  END IF;
END $$;

ALTER TABLE public.integracoes_execucoes_log
  ADD CONSTRAINT integracoes_execucoes_log_acao_check
  CHECK (acao IN (
    'test_connection',
    'list_files',
    'download_file',
    'import_extrato',
    'import_extrato_arquivo',
    'sync'
  ));
