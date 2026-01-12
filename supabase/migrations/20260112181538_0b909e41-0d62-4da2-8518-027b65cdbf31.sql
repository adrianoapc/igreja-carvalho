-- Sessões de contagem e contagens (conferência cega)
CREATE TABLE IF NOT EXISTS public.sessoes_contagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  filial_id UUID NULL REFERENCES public.filiais(id) ON DELETE SET NULL,

  data_culto DATE NOT NULL,
  periodo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','aguardando_conferencia','divergente','validado','cancelado','reaberto')),

  -- Snapshot de parâmetros no momento da abertura
  blind_count_mode TEXT NOT NULL,
  blind_min_counters INTEGER NOT NULL,
  blind_tolerance_value NUMERIC(12,2) NOT NULL,
  blind_compare_level TEXT NOT NULL,
  blind_lock_totals BOOLEAN NOT NULL,
  provider_tipo TEXT NULL,
  webhook_url TEXT NULL,
  secret_hint TEXT NULL,
  sync_strategy TEXT NULL,

  conferentes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,

  variance_value NUMERIC(12,2) NULL,
  variance_by_tipo JSONB NULL,

  rejection_reason_code TEXT NULL,
  rejection_reason_note TEXT NULL,
  rejection_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_contagem_igreja ON public.sessoes_contagem(igreja_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_contagem_filial ON public.sessoes_contagem(filial_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_contagem_status ON public.sessoes_contagem(status);

ALTER TABLE public.sessoes_contagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessoes_contagem_select_same_church"
ON public.sessoes_contagem FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.igreja_id = sessoes_contagem.igreja_id
  )
);

CREATE POLICY "sessoes_contagem_insert_admin"
ON public.sessoes_contagem FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.igreja_id = sessoes_contagem.igreja_id
  )
);

CREATE POLICY "sessoes_contagem_update_admin"
ON public.sessoes_contagem FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.igreja_id = sessoes_contagem.igreja_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.igreja_id = sessoes_contagem.igreja_id
  )
);

-- Contagens individuais
CREATE TABLE IF NOT EXISTS public.contagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL REFERENCES public.sessoes_contagem(id) ON DELETE CASCADE,
  contador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ordem SMALLINT NOT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  totais_por_tipo JSONB NOT NULL DEFAULT '{"dizimo":0,"oferta":0,"missoes":0}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contagens_sessao ON public.contagens(sessao_id);
CREATE INDEX IF NOT EXISTS idx_contagens_contador ON public.contagens(contador_id);

ALTER TABLE public.contagens ENABLE ROW LEVEL SECURITY;

-- Seleção por usuários da mesma igreja da sessão
CREATE POLICY "contagens_select_same_church"
ON public.contagens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessoes_contagem s
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = contagens.sessao_id AND p.igreja_id = s.igreja_id
  )
);

-- Conferentes podem inserir sua própria contagem; admins também
CREATE POLICY "contagens_insert_conferente_or_admin"
ON public.contagens FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessoes_contagem s
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = contagens.sessao_id AND p.igreja_id = s.igreja_id
  )
);

COMMENT ON TABLE public.sessoes_contagem IS 'Sessões/Lotes de contagem física, com snapshot de parâmetros e auditoria.';
COMMENT ON TABLE public.contagens IS 'Contagens submetidas por conferentes para confronto (conferência cega).';