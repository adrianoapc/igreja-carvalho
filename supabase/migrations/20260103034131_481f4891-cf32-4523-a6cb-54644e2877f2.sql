-- Adiciona campo para autorizar uso do bot financeiro
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS autorizado_bot_financeiro boolean DEFAULT false;

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.autorizado_bot_financeiro IS 'Se true, permite que o membro envie solicitações via chatbot financeiro';