-- Adiciona colunas para gerenciamento de crianças no profiles
-- data_nascimento já existe, então adicionamos apenas as novas colunas

-- 1. Alergias e Cuidados (para etiqueta de segurança)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alergias TEXT;

-- 2. Vínculo Familiar (referência à família)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS familia_id UUID REFERENCES public.familias(id) ON DELETE SET NULL;

-- 3. Flag de Responsável Legal (quem pode fazer check-out)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS responsavel_legal BOOLEAN DEFAULT false;