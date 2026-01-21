-- Adiciona coluna tipo para classificar números WhatsApp
ALTER TABLE whatsapp_numeros 
ADD COLUMN tipo VARCHAR(20) DEFAULT 'PUBLICO' 
CHECK (tipo IN ('PUBLICO', 'ADMIN'));

-- Cria índice para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_numeros_tipo ON whatsapp_numeros(tipo);

-- Comentário
COMMENT ON COLUMN whatsapp_numeros.tipo IS 'Tipo do número: PUBLICO (atendimento geral via triagem) ou ADMIN (financeiro/interno)';