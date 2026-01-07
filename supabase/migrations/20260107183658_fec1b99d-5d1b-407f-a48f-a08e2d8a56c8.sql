-- Tabela temporária para importação de transações
CREATE TABLE public.importacao_transacoes_temp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR(10) NOT NULL, -- 'entrada' ou 'saida'
  regional TEXT,
  igreja TEXT,
  conta TEXT,
  rede TEXT,
  celula TEXT,
  data_vencimento DATE,
  data_competencia DATE,
  valor_base NUMERIC(15,2),
  valor_pago NUMERIC(15,2),
  descricao TEXT,
  categoria TEXT,
  subcategoria TEXT,
  centro_custo TEXT,
  unidade_negocio TEXT,
  fornecedor_pagador TEXT,
  data_pagamento_recebimento DATE,
  juros NUMERIC(15,2) DEFAULT 0,
  multas NUMERIC(15,2) DEFAULT 0,
  desconto NUMERIC(15,2) DEFAULT 0,
  taxas_administrativas NUMERIC(15,2) DEFAULT 0,
  id_ecommerce TEXT,
  id_transacao TEXT,
  igreja_id UUID,
  filial_id UUID,
  processado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.importacao_transacoes_temp ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários autenticados podem visualizar importações de sua igreja"
ON public.importacao_transacoes_temp FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem inserir importações"
ON public.importacao_transacoes_temp FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar importações"
ON public.importacao_transacoes_temp FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar importações"
ON public.importacao_transacoes_temp FOR DELETE
USING (auth.uid() IS NOT NULL);