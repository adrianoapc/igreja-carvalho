-- Add endereco (full address) column to cultos table for better Google Maps precision
ALTER TABLE public.cultos ADD COLUMN endereco text;