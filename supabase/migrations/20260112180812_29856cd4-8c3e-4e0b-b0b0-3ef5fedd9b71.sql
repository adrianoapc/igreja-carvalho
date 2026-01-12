-- Financeiro: parâmetros por igreja/filial (feature flags e comportamento)
CREATE TABLE IF NOT EXISTS public.financeiro_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES public.filiais(id) ON DELETE SET NULL,

  -- Integrações (flags não sensíveis)
  integracao_pix_enabled BOOLEAN NOT NULL DEFAULT false,
  integracao_gateway_enabled BOOLEAN NOT NULL DEFAULT false,
  integracao_banco_enabled BOOLEAN NOT NULL DEFAULT false,
  sync_strategy TEXT NOT NULL DEFAULT 'webhook' CHECK (sync_strategy IN ('webhook','polling')),
  conciliacao_janela_horas INTEGER NOT NULL DEFAULT 24,

  -- Conferência cega (parâmetros globais)
  blind_count_mode TEXT NOT NULL DEFAULT 'optional' CHECK (blind_count_mode IN ('off','optional','required')),
  blind_min_counters INTEGER NOT NULL DEFAULT 2,
  blind_tolerance_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  blind_compare_level TEXT NOT NULL DEFAULT 'total' CHECK (blind_compare_level IN ('total','tipo')),
  blind_lock_totals BOOLEAN NOT NULL DEFAULT true,

  -- Mapeamentos funcionais leves (ex.: fallback forma->conta)
  mapping_default_conta_por_forma JSONB NOT NULL DEFAULT '{}'::jsonb,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(igreja_id, filial_id)
);

CREATE INDEX IF NOT EXISTS idx_finconfig_igreja ON public.financeiro_config(igreja_id);
CREATE INDEX IF NOT EXISTS idx_finconfig_filial ON public.financeiro_config(filial_id);

ALTER TABLE public.financeiro_config ENABLE ROW LEVEL SECURITY;

-- Política: leitura por usuários da mesma igreja
CREATE POLICY "financeiro_config_select_same_church"
ON public.financeiro_config FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.igreja_id = financeiro_config.igreja_id
  )
);

-- Política: admins atualizam/criam
CREATE POLICY "financeiro_config_admin_all"
ON public.financeiro_config FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin' AND ur.igreja_id = financeiro_config.igreja_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin' AND ur.igreja_id = financeiro_config.igreja_id
  )
);

COMMENT ON TABLE public.financeiro_config IS 'Parâmetros financeiros por igreja/filial (integrações, conciliação e conferência cega).';