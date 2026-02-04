-- ML Conciliação: sugestões e feedback
CREATE TABLE IF NOT EXISTS public.conciliacao_ml_sugestoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id UUID NOT NULL REFERENCES igrejas(id),
  filial_id UUID REFERENCES filiais(id),
  conta_id UUID REFERENCES contas(id),
  tipo_match TEXT NOT NULL CHECK (tipo_match IN ('1:1', '1:N', 'N:1')),
  extrato_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  transacao_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  score NUMERIC(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  modelo_versao TEXT DEFAULT 'v1',
  origem TEXT NOT NULL DEFAULT 'ml' CHECK (origem IN ('ml', 'regra')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'rejeitada', 'expirada')),
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_sugestoes_igreja ON public.conciliacao_ml_sugestoes(igreja_id);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_sugestoes_conta ON public.conciliacao_ml_sugestoes(conta_id);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_sugestoes_status ON public.conciliacao_ml_sugestoes(status);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_sugestoes_score ON public.conciliacao_ml_sugestoes(score DESC);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_sugestoes_created_at ON public.conciliacao_ml_sugestoes(created_at);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_sugestoes_extratos_gin ON public.conciliacao_ml_sugestoes USING GIN (extrato_ids);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_sugestoes_transacoes_gin ON public.conciliacao_ml_sugestoes USING GIN (transacao_ids);

CREATE TRIGGER update_conciliacao_ml_sugestoes_updated_at
BEFORE UPDATE ON public.conciliacao_ml_sugestoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.conciliacao_ml_sugestoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conciliação ML sugestões from their church"
ON public.conciliacao_ml_sugestoes FOR SELECT
USING (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert conciliação ML sugestões for their church"
ON public.conciliacao_ml_sugestoes FOR INSERT
WITH CHECK (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update conciliação ML sugestões from their church"
ON public.conciliacao_ml_sugestoes FOR UPDATE
USING (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

-- Feedback humano para treinamento
CREATE TABLE IF NOT EXISTS public.conciliacao_ml_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sugestao_id UUID REFERENCES public.conciliacao_ml_sugestoes(id) ON DELETE SET NULL,
  igreja_id UUID NOT NULL REFERENCES igrejas(id),
  filial_id UUID REFERENCES filiais(id),
  conta_id UUID REFERENCES contas(id),
  tipo_match TEXT NOT NULL CHECK (tipo_match IN ('1:1', '1:N', 'N:1')),
  extrato_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  transacao_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  acao TEXT NOT NULL CHECK (acao IN ('aceita', 'rejeitada', 'ajustada')),
  score NUMERIC(5,4) CHECK (score >= 0 AND score <= 1),
  modelo_versao TEXT,
  ajustes JSONB NOT NULL DEFAULT '{}'::jsonb,
  usuario_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_feedback_igreja ON public.conciliacao_ml_feedback(igreja_id);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_feedback_conta ON public.conciliacao_ml_feedback(conta_id);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_feedback_created_at ON public.conciliacao_ml_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_feedback_extratos_gin ON public.conciliacao_ml_feedback USING GIN (extrato_ids);
CREATE INDEX IF NOT EXISTS idx_conciliacao_ml_feedback_transacoes_gin ON public.conciliacao_ml_feedback USING GIN (transacao_ids);

ALTER TABLE public.conciliacao_ml_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conciliação ML feedback from their church"
ON public.conciliacao_ml_feedback FOR SELECT
USING (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert conciliação ML feedback for their church"
ON public.conciliacao_ml_feedback FOR INSERT
WITH CHECK (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

-- PIX recebimentos (acompanhamento de ofertas)
CREATE TABLE IF NOT EXISTS public.pix_recebimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pix_id TEXT NOT NULL UNIQUE,
  data_pix TIMESTAMP WITH TIME ZONE NOT NULL,
  valor NUMERIC NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'conciliado', 'cancelado', 'erro')),
  conta_id UUID REFERENCES contas(id),
  extrato_id UUID REFERENCES extratos_bancarios(id),
  transacao_id UUID REFERENCES transacoes_financeiras(id),
  sessao_item_id UUID REFERENCES sessoes_itens_draft(id),
  igreja_id UUID NOT NULL REFERENCES igrejas(id),
  filial_id UUID REFERENCES filiais(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pix_recebimentos_igreja ON public.pix_recebimentos(igreja_id);
CREATE INDEX IF NOT EXISTS idx_pix_recebimentos_conta ON public.pix_recebimentos(conta_id);
CREATE INDEX IF NOT EXISTS idx_pix_recebimentos_data_pix ON public.pix_recebimentos(data_pix);
CREATE INDEX IF NOT EXISTS idx_pix_recebimentos_status ON public.pix_recebimentos(status);
CREATE INDEX IF NOT EXISTS idx_pix_recebimentos_extrato ON public.pix_recebimentos(extrato_id);
CREATE INDEX IF NOT EXISTS idx_pix_recebimentos_transacao ON public.pix_recebimentos(transacao_id);

ALTER TABLE public.pix_recebimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pix recebimentos from their church"
ON public.pix_recebimentos FOR SELECT
USING (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert pix recebimentos for their church"
ON public.pix_recebimentos FOR INSERT
WITH CHECK (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update pix recebimentos from their church"
ON public.pix_recebimentos FOR UPDATE
USING (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (igreja_id IN (SELECT igreja_id FROM profiles WHERE user_id = auth.uid()));