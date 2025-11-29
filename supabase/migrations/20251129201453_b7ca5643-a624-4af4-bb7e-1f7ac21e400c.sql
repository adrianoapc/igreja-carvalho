-- Criar tabela de formas de pagamento
CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins e tesoureiros podem gerenciar formas de pagamento"
  ON public.formas_pagamento
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_formas_pagamento_updated_at
  BEFORE UPDATE ON public.formas_pagamento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir formas de pagamento padrão
INSERT INTO public.formas_pagamento (nome) VALUES
  ('Dinheiro'),
  ('Cartão de Crédito'),
  ('Boleto Bancário'),
  ('Cartão de Débito'),
  ('Débito em conta'),
  ('PIX'),
  ('Transferência Bancária'),
  ('Cheque');

-- Adicionar novos campos à tabela de transações
ALTER TABLE public.transacoes_financeiras
  ADD COLUMN IF NOT EXISTS juros NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS multas NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxas_administrativas NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC;

-- Criar índice para forma_pagamento (já existe como texto, vamos manter por compatibilidade)
CREATE INDEX IF NOT EXISTS idx_transacoes_forma_pagamento ON public.transacoes_financeiras(forma_pagamento);