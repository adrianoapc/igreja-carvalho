-- Adicionar colunas de configuração WhatsApp/Notificações na tabela configuracoes_igreja
ALTER TABLE public.configuracoes_igreja 
ADD COLUMN whatsapp_provider TEXT DEFAULT 'make_webhook',
ADD COLUMN whatsapp_token TEXT,
ADD COLUMN whatsapp_instance_id TEXT,
ADD COLUMN telefone_plantao_pastoral TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.configuracoes_igreja.whatsapp_provider IS 'Provedor WhatsApp: make_webhook, meta_official, evolution_api';
COMMENT ON COLUMN public.configuracoes_igreja.whatsapp_token IS 'Token de autenticação do provedor WhatsApp';
COMMENT ON COLUMN public.configuracoes_igreja.whatsapp_instance_id IS 'ID da instância (Evolution) ou phone_number_id (Meta)';
COMMENT ON COLUMN public.configuracoes_igreja.telefone_plantao_pastoral IS 'Telefone do pastor/líder de plantão para alertas críticos';