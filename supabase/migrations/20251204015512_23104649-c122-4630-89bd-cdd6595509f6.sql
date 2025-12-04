-- Add attendance_mode column to presencas_aula table
ALTER TABLE public.presencas_aula 
ADD COLUMN IF NOT EXISTS attendance_mode text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.presencas_aula.attendance_mode IS 'Modo de presença para aulas híbridas: presencial ou online';