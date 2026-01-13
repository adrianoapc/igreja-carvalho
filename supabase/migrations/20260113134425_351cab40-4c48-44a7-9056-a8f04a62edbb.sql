-- Adiciona a coluna is_digital para classificar formas físicas vs digitais
ALTER TABLE public.formas_pagamento
ADD COLUMN IF NOT EXISTS is_digital boolean NOT NULL DEFAULT false;

-- Índice opcional para filtros frequentes
CREATE INDEX IF NOT EXISTS formas_pagamento_is_digital_idx
ON public.formas_pagamento (is_digital);

-- Comentário explicativo
COMMENT ON COLUMN public.formas_pagamento.is_digital IS 'True para digitais (PIX, cartão, gateways). False para físicas (dinheiro, cheque).';