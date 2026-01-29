-- Inserir webhook global do sistema (fallback para todas as igrejas)
INSERT INTO webhooks (igreja_id, filial_id, tipo, url, enabled)
VALUES 
  (NULL, NULL, 'whatsapp_make', 'https://hook.us2.make.com/j8rhitc7bb886u3i1j9q13trlpp291x3', true)
ON CONFLICT (igreja_id, tipo) WHERE igreja_id IS NULL DO UPDATE SET
  url = EXCLUDED.url,
  enabled = EXCLUDED.enabled;

-- Inserir número WhatsApp global do sistema (fallback)
INSERT INTO whatsapp_numeros (igreja_id, filial_id, display_phone_number, phone_number_id, provider, enabled)
VALUES 
  (NULL, NULL, '5517996603391', '1031291743394274', 'meta', true)
ON CONFLICT DO NOTHING;

-- Comentários documentando a arquitetura
COMMENT ON TABLE webhooks IS 'Webhooks para integrações. Quando igreja_id IS NULL, representa configuração global do sistema (fallback).';
COMMENT ON TABLE whatsapp_numeros IS 'Números WhatsApp para envio de mensagens. Quando igreja_id IS NULL, representa configuração global do sistema (fallback).';