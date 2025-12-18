-- Adicionar coluna ultimo_aviso_em na tabela escalas_culto para controle anti-spam
ALTER TABLE public.escalas_culto 
ADD COLUMN IF NOT EXISTS ultimo_aviso_em TIMESTAMP WITH TIME ZONE;

-- Comentário para documentação
COMMENT ON COLUMN public.escalas_culto.ultimo_aviso_em IS 'Data/hora do último envio de notificação (manual ou automático) para evitar spam';