
CREATE TABLE IF NOT EXISTS public.configuracoes_financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES public.filiais(id) ON DELETE SET NULL,

  -- Configurações de Contagem Cega (Blind Count)
  blind_count_mode TEXT NOT NULL DEFAULT 'disabled' CHECK (blind_count_mode IN ('disabled', 'optional', 'required')),
  blind_min_counters INTEGER NOT NULL DEFAULT 2 CHECK (blind_min_counters >= 2),
  blind_tolerance_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  blind_compare_level TEXT NOT NULL DEFAULT 'total' CHECK (blind_compare_level IN ('total', 'forma_pagamento', 'denominacao')),
  blind_lock_totals BOOLEAN NOT NULL DEFAULT false,

  -- Integração com Provider Externo
  provider_tipo TEXT CHECK (provider_tipo IN ('picpay', 'pagbank', 'mercadopago', 'outro')),
  webhook_url TEXT,
  secret_hint TEXT,
  sync_strategy TEXT DEFAULT 'manual' CHECK (sync_strategy IN ('manual', 'auto_on_close', 'realtime')),

  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraint: uma config por igreja (ou por filial se especificado)
  UNIQUE(igreja_id, filial_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_configuracoes_financeiro_igreja_id 
ON public.configuracoes_financeiro(igreja_id);

CREATE INDEX IF NOT EXISTS idx_configuracoes_financeiro_filial_id 
ON public.configuracoes_financeiro(filial_id);

-- RLS
ALTER TABLE public.configuracoes_financeiro ENABLE ROW LEVEL SECURITY;

-- Políticas: Admins e Tesoureiros podem gerenciar
CREATE POLICY "Admin e Tesoureiro gerenciam configurações"
ON public.configuracoes_financeiro
FOR ALL
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'tesoureiro'::app_role)
);

-- Trigger para updated_at
CREATE TRIGGER update_configuracoes_financeiro_updated_at
BEFORE UPDATE ON public.configuracoes_financeiro
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.configuracoes_financeiro IS 'Configurações de contagem e integração financeira por igreja/filial';
COMMENT ON COLUMN public.configuracoes_financeiro.blind_count_mode IS 'Modo de contagem cega: disabled, optional, required';
COMMENT ON COLUMN public.configuracoes_financeiro.blind_min_counters IS 'Número mínimo de contadores para contagem cega';
COMMENT ON COLUMN public.configuracoes_financeiro.blind_tolerance_value IS 'Valor de tolerância para diferenças na contagem cega';
COMMENT ON COLUMN public.configuracoes_financeiro.provider_tipo IS 'Tipo de provider de pagamento integrado';
