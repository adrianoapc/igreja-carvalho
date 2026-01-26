-- Add column for requiring document verification on check-in
ALTER TABLE public.eventos
ADD COLUMN IF NOT EXISTS exigir_documento_checkin boolean DEFAULT false;

COMMENT ON COLUMN public.eventos.exigir_documento_checkin IS 
  'Se TRUE, operador deve validar documento do participante antes de confirmar check-in';