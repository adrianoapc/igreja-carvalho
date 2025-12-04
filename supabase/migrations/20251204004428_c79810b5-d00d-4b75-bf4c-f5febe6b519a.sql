-- Adiciona a flag de visibilidade para portal do aluno
ALTER TABLE public.jornadas 
ADD COLUMN IF NOT EXISTS exibir_portal BOOLEAN DEFAULT true;