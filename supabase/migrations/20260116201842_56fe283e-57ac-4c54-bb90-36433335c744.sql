-- Ensure deduplication works for Santander sync upserts
-- Upsert uses ON CONFLICT (conta_id, external_id), so we must have a UNIQUE constraint/index on these columns.
ALTER TABLE public.extratos_bancarios
ADD CONSTRAINT extratos_bancarios_conta_id_external_id_key UNIQUE (conta_id, external_id);
