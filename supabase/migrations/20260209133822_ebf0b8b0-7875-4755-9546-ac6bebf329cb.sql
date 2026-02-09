
-- Parte 1: Tabela de cobranças PIX criadas
CREATE TABLE IF NOT EXISTS public.cob_pix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  txid TEXT NOT NULL UNIQUE,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais(id),
  sessao_item_id UUID REFERENCES sessoes_itens_draft(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES contas(id),
  valor_original NUMERIC(10,2) NOT NULL,
  chave_pix TEXT NOT NULL,
  descricao TEXT,
  qr_location TEXT,
  qr_brcode TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'CONCLUIDA', 'REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP')),
  expiracao INTEGER DEFAULT 3600,
  info_adicionais JSONB DEFAULT '{}'::jsonb,
  payload_resposta JSONB,
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_expiracao TIMESTAMP WITH TIME ZONE,
  data_conclusao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cob_pix_txid ON public.cob_pix(txid);
CREATE INDEX IF NOT EXISTS idx_cob_pix_igreja ON public.cob_pix(igreja_id);
CREATE INDEX IF NOT EXISTS idx_cob_pix_sessao_item ON public.cob_pix(sessao_item_id);
CREATE INDEX IF NOT EXISTS idx_cob_pix_status ON public.cob_pix(status);
CREATE INDEX IF NOT EXISTS idx_cob_pix_data_criacao ON public.cob_pix(data_criacao DESC);

-- Trigger para updated_at
CREATE TRIGGER update_cob_pix_updated_at
BEFORE UPDATE ON public.cob_pix
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cob_pix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cobranças PIX from their church"
ON public.cob_pix FOR SELECT
USING (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert cobranças PIX for their church"
ON public.cob_pix FOR INSERT
WITH CHECK (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update cobranças PIX from their church"
ON public.cob_pix FOR UPDATE
USING (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

-- Parte 2: Adicionar campo txid em pix_webhook_temp
ALTER TABLE public.pix_webhook_temp 
ADD COLUMN IF NOT EXISTS txid TEXT,
ADD COLUMN IF NOT EXISTS cob_pix_id UUID REFERENCES public.cob_pix(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pix_webhook_temp_txid ON public.pix_webhook_temp(txid);
CREATE INDEX IF NOT EXISTS idx_pix_webhook_temp_cob_pix_id ON public.pix_webhook_temp(cob_pix_id);

-- Comentários
COMMENT ON TABLE public.cob_pix IS 'Cobranças PIX criadas via API Santander (PUT /cob/{txid})';
COMMENT ON COLUMN public.cob_pix.txid IS 'Identificador único da cobrança (txid) - sequencial alfanumérico';
COMMENT ON COLUMN public.cob_pix.qr_location IS 'URL do QR code retornado pelo Santander';
COMMENT ON COLUMN public.cob_pix.info_adicionais IS 'Campos adicionais enviados na criação (ex: sessao_item_id)';
COMMENT ON COLUMN public.pix_webhook_temp.txid IS 'txid da cobrança (se vier do webhook de cobrança paga)';
COMMENT ON COLUMN public.pix_webhook_temp.cob_pix_id IS 'Referência para cobrança criada (vinculação automática)';
