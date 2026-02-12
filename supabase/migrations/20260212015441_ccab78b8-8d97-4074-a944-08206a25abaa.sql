
-- Reverter renomeação das colunas para não quebrar a aplicação
ALTER TABLE public.profiles RENAME COLUMN legacy_telefone TO telefone;
ALTER TABLE public.profiles RENAME COLUMN legacy_email TO email;
