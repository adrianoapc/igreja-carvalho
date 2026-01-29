-- Tabela principal de lotes de conciliação N:1
CREATE TABLE public.conciliacoes_lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id UUID NOT NULL REFERENCES public.transacoes_financeiras(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id),
  filial_id UUID REFERENCES public.filiais(id),
  conta_id UUID REFERENCES public.contas(id),
  valor_transacao NUMERIC(15,2) NOT NULL,
  valor_extratos NUMERIC(15,2) NOT NULL DEFAULT 0,
  diferenca NUMERIC(15,2) GENERATED ALWAYS AS (valor_transacao - valor_extratos) STORED,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliada', 'discrepancia')),
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de vínculos extrato <-> lote
CREATE TABLE public.conciliacoes_lote_extratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliacao_lote_id UUID NOT NULL REFERENCES public.conciliacoes_lote(id) ON DELETE CASCADE,
  extrato_id UUID NOT NULL REFERENCES public.extratos_bancarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(extrato_id) -- Um extrato só pode estar em um lote
);

-- Trigger para atualizar valor_extratos automaticamente quando extratos são adicionados/removidos
CREATE OR REPLACE FUNCTION public.update_valor_extratos()
RETURNS TRIGGER AS $$
DECLARE
  lote_id UUID;
BEGIN
  -- Determinar qual lote atualizar
  IF TG_OP = 'DELETE' THEN
    lote_id := OLD.conciliacao_lote_id;
  ELSE
    lote_id := NEW.conciliacao_lote_id;
  END IF;
  
  -- Atualizar soma dos extratos no lote
  UPDATE public.conciliacoes_lote
  SET valor_extratos = (
    SELECT COALESCE(SUM(e.valor), 0)
    FROM public.conciliacoes_lote_extratos cle
    JOIN public.extratos_bancarios e ON e.id = cle.extrato_id
    WHERE cle.conciliacao_lote_id = lote_id
  ),
  updated_at = now()
  WHERE id = lote_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_valor_extratos
AFTER INSERT OR DELETE ON public.conciliacoes_lote_extratos
FOR EACH ROW EXECUTE FUNCTION public.update_valor_extratos();

-- Trigger para marcar extratos como reconciliados quando lote é concluído
CREATE OR REPLACE FUNCTION public.marcar_extratos_reconciliados()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'conciliada' AND (OLD.status IS NULL OR OLD.status != 'conciliada') THEN
    UPDATE public.extratos_bancarios
    SET reconciliado = true
    WHERE id IN (
      SELECT extrato_id 
      FROM public.conciliacoes_lote_extratos 
      WHERE conciliacao_lote_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_marcar_extratos_reconciliados
AFTER UPDATE ON public.conciliacoes_lote
FOR EACH ROW EXECUTE FUNCTION public.marcar_extratos_reconciliados();

-- Habilitar RLS
ALTER TABLE public.conciliacoes_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacoes_lote_extratos ENABLE ROW LEVEL SECURITY;

-- Policies para conciliacoes_lote (admin/tesoureiro podem gerenciar)
CREATE POLICY "Usuários autenticados podem visualizar lotes da sua igreja"
ON public.conciliacoes_lote
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profiles 
    WHERE igreja_id = conciliacoes_lote.igreja_id
  )
);

CREATE POLICY "Usuários autenticados podem criar lotes na sua igreja"
ON public.conciliacoes_lote
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.profiles 
    WHERE igreja_id = conciliacoes_lote.igreja_id
  )
);

CREATE POLICY "Usuários autenticados podem atualizar lotes da sua igreja"
ON public.conciliacoes_lote
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profiles 
    WHERE igreja_id = conciliacoes_lote.igreja_id
  )
);

CREATE POLICY "Usuários autenticados podem deletar lotes da sua igreja"
ON public.conciliacoes_lote
FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profiles 
    WHERE igreja_id = conciliacoes_lote.igreja_id
  )
);

-- Policies para conciliacoes_lote_extratos
CREATE POLICY "Usuários podem visualizar vínculos de lotes da sua igreja"
ON public.conciliacoes_lote_extratos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conciliacoes_lote cl
    WHERE cl.id = conciliacoes_lote_extratos.conciliacao_lote_id
    AND auth.uid() IN (
      SELECT user_id FROM public.profiles 
      WHERE igreja_id = cl.igreja_id
    )
  )
);

CREATE POLICY "Usuários podem criar vínculos em lotes da sua igreja"
ON public.conciliacoes_lote_extratos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conciliacoes_lote cl
    WHERE cl.id = conciliacoes_lote_extratos.conciliacao_lote_id
    AND auth.uid() IN (
      SELECT user_id FROM public.profiles 
      WHERE igreja_id = cl.igreja_id
    )
  )
);

CREATE POLICY "Usuários podem deletar vínculos de lotes da sua igreja"
ON public.conciliacoes_lote_extratos
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.conciliacoes_lote cl
    WHERE cl.id = conciliacoes_lote_extratos.conciliacao_lote_id
    AND auth.uid() IN (
      SELECT user_id FROM public.profiles 
      WHERE igreja_id = cl.igreja_id
    )
  )
);

-- Índices para performance
CREATE INDEX idx_conciliacoes_lote_transacao ON public.conciliacoes_lote(transacao_id);
CREATE INDEX idx_conciliacoes_lote_igreja ON public.conciliacoes_lote(igreja_id);
CREATE INDEX idx_conciliacoes_lote_status ON public.conciliacoes_lote(status);
CREATE INDEX idx_conciliacoes_lote_extratos_lote ON public.conciliacoes_lote_extratos(conciliacao_lote_id);
CREATE INDEX idx_conciliacoes_lote_extratos_extrato ON public.conciliacoes_lote_extratos(extrato_id);