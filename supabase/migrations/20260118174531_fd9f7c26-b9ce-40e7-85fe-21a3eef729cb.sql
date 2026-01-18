-- Add QR token and check-in audit fields to inscricoes_eventos

ALTER TABLE public.inscricoes_eventos
ADD COLUMN IF NOT EXISTS qr_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS checkin_validado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checkin_validado_por UUID REFERENCES auth.users(id);

-- Populate existing rows with QR tokens
UPDATE public.inscricoes_eventos
SET qr_token = gen_random_uuid()
WHERE qr_token IS NULL;

-- Create unique index for fast QR token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_inscricoes_eventos_qr_token
ON public.inscricoes_eventos(qr_token);