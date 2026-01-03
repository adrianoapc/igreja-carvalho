-- Adiciona a coluna para distinguir se o papo é Financeiro ou Pastoral
ALTER TABLE atendimentos_bot 
ADD COLUMN IF NOT EXISTS origem_canal text DEFAULT 'whatsapp_oracao';

-- Cria um índice otimizado para buscar a sessão ativa no canal certo
-- Isso evita que uma mensagem no Financeiro "acorde" uma sessão de Oração
CREATE INDEX IF NOT EXISTS idx_atendimentos_bot_sessao_ativa 
ON atendimentos_bot(telefone, origem_canal) 
WHERE status != 'CONCLUIDO';