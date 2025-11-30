-- Adicionar campo para webhook do Make nas configurações
ALTER TABLE public.configuracoes_igreja 
ADD COLUMN webhook_make_liturgia TEXT;

COMMENT ON COLUMN public.configuracoes_igreja.webhook_make_liturgia IS 'URL do webhook do Make.com para notificações de liturgia';