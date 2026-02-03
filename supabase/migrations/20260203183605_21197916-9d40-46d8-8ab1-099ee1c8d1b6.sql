-- Tabelas para suporte 1:N (1 extrato → múltiplas transações)
CREATE TABLE public.conciliacoes_divisao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extrato_id UUID NOT NULL REFERENCES public.extratos_bancarios(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES public.filiais(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  valor_extrato NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'conciliada',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conciliacoes_divisao_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliacao_divisao_id UUID NOT NULL REFERENCES public.conciliacoes_divisao(id) ON DELETE CASCADE,
  transacao_id UUID NOT NULL REFERENCES public.transacoes_financeiras(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_conciliacoes_divisao_extrato ON public.conciliacoes_divisao(extrato_id);
CREATE INDEX idx_conciliacoes_divisao_igreja ON public.conciliacoes_divisao(igreja_id);
CREATE INDEX idx_conciliacoes_divisao_transacoes_divisao ON public.conciliacoes_divisao_transacoes(conciliacao_divisao_id);
CREATE INDEX idx_conciliacoes_divisao_transacoes_transacao ON public.conciliacoes_divisao_transacoes(transacao_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_conciliacoes_divisao_updated_at
  BEFORE UPDATE ON public.conciliacoes_divisao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para marcar extrato como reconciliado quando divisão é criada
CREATE OR REPLACE FUNCTION public.marcar_extrato_divisao_reconciliado()
RETURNS TRIGGER AS $$
BEGIN
  -- Marcar o extrato como reconciliado
  UPDATE public.extratos_bancarios
  SET reconciliado = true
  WHERE id = NEW.extrato_id;
  
  -- Registrar no log de auditoria
  INSERT INTO public.reconciliacao_audit_logs (
    extrato_id,
    transacao_id,
    acao,
    tipo_match,
    score,
    usuario_id,
    igreja_id,
    filial_id,
    detalhes
  ) VALUES (
    NEW.extrato_id,
    NULL,
    'divisao_criada',
    'manual',
    100,
    NEW.created_by,
    NEW.igreja_id,
    NEW.filial_id,
    jsonb_build_object('divisao_id', NEW.id, 'valor_extrato', NEW.valor_extrato)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_marcar_extrato_divisao
  AFTER INSERT ON public.conciliacoes_divisao
  FOR EACH ROW
  EXECUTE FUNCTION public.marcar_extrato_divisao_reconciliado();

-- Enable RLS
ALTER TABLE public.conciliacoes_divisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacoes_divisao_transacoes ENABLE ROW LEVEL SECURITY;

-- Policies para conciliacoes_divisao
CREATE POLICY "Users can view their church divisoes"
  ON public.conciliacoes_divisao
  FOR SELECT
  USING (
    igreja_id IN (
      SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create divisoes for their church"
  ON public.conciliacoes_divisao
  FOR INSERT
  WITH CHECK (
    igreja_id IN (
      SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their church divisoes"
  ON public.conciliacoes_divisao
  FOR UPDATE
  USING (
    igreja_id IN (
      SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their church divisoes"
  ON public.conciliacoes_divisao
  FOR DELETE
  USING (
    igreja_id IN (
      SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Policies para conciliacoes_divisao_transacoes
CREATE POLICY "Users can view divisao transacoes"
  ON public.conciliacoes_divisao_transacoes
  FOR SELECT
  USING (
    conciliacao_divisao_id IN (
      SELECT id FROM public.conciliacoes_divisao
      WHERE igreja_id IN (
        SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create divisao transacoes"
  ON public.conciliacoes_divisao_transacoes
  FOR INSERT
  WITH CHECK (
    conciliacao_divisao_id IN (
      SELECT id FROM public.conciliacoes_divisao
      WHERE igreja_id IN (
        SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete divisao transacoes"
  ON public.conciliacoes_divisao_transacoes
  FOR DELETE
  USING (
    conciliacao_divisao_id IN (
      SELECT id FROM public.conciliacoes_divisao
      WHERE igreja_id IN (
        SELECT igreja_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );