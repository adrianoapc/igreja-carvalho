-- Adiciona campo para marcar eventos com coleta de oferta
ALTER TABLE public.eventos
ADD COLUMN IF NOT EXISTS tem_oferta BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.eventos.tem_oferta IS 'Indica se haverá coleta de oferta/contribuição neste evento (culto, conferência, etc)';