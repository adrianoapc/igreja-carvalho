-- 1. Adicionar o novo papel 'tecnico' ao enum de roles do sistema
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tecnico';