-- Adicionar coluna para forçar troca de senha no primeiro login
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deve_trocar_senha boolean DEFAULT false;

COMMENT ON COLUMN public.profiles.deve_trocar_senha IS 'Flag que indica se o usuário deve trocar a senha no primeiro login';