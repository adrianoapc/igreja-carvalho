-- Add exibir_preletor column to cultos table
ALTER TABLE public.cultos 
ADD COLUMN exibir_preletor boolean NOT NULL DEFAULT true;