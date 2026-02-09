-- Adicionar rastreamento de eventos e fechamento às sessões de contagem
ALTER TABLE public.sessoes_contagem 
ADD COLUMN IF NOT EXISTS evento_id UUID REFERENCES public.eventos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS data_fechamento TIMESTAMPTZ;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_sessoes_contagem_evento_id ON public.sessoes_contagem(evento_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_contagem_data_fechamento ON public.sessoes_contagem(data_fechamento);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.sessoes_contagem.evento_id IS 'Vínculo opcional com evento do calendário da igreja (cultos, eventos especiais)';
COMMENT ON COLUMN public.sessoes_contagem.data_fechamento IS 'Timestamp de quando a sessão foi finalizada/fechada - usado para calcular janela de sincronização bancária';

-- Atualizar status enum para incluir 'finalizado'
ALTER TABLE public.sessoes_contagem 
DROP CONSTRAINT IF EXISTS sessoes_contagem_status_check;

ALTER TABLE public.sessoes_contagem 
ADD CONSTRAINT sessoes_contagem_status_check 
CHECK (status IN ('aberto','aguardando_conferencia','divergente','validado','cancelado','reaberto','finalizado'));