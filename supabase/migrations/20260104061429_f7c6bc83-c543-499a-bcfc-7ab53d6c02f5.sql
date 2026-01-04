-- Parte 1: Adicionar role super_admin ao enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';