ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS autorizado_lancar_despesas BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autorizado_lancar_depositos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autorizado_lancar_reembolsos BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles
SET autorizado_lancar_despesas = true,
    autorizado_lancar_depositos = true,
    autorizado_lancar_reembolsos = true
WHERE autorizado_bot_financeiro = true;