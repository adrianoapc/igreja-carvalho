
-- Add missing columns for desconciliacao support
ALTER TABLE public.reconciliacao_audit_logs 
  ADD COLUMN IF NOT EXISTS acao TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Drop the old CHECK constraint and replace with one that includes 'desconciliacao'
ALTER TABLE public.reconciliacao_audit_logs 
  DROP CONSTRAINT IF EXISTS reconciliacao_audit_logs_tipo_reconciliacao_check;

ALTER TABLE public.reconciliacao_audit_logs 
  ADD CONSTRAINT reconciliacao_audit_logs_tipo_reconciliacao_check 
  CHECK (tipo_reconciliacao IN ('automatica', 'manual', 'lote', 'desconciliacao'));
