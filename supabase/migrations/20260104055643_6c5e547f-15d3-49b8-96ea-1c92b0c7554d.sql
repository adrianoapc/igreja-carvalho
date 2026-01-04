-- =====================================================
-- MIGRAÇÃO Parte 1A: Adicionar valores de enum
-- =====================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_igreja';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_filial';