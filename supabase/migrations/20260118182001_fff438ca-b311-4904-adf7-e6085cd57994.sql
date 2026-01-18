-- Add subtipo Acao Social if not exists
INSERT INTO public.evento_subtipos (nome, tipo_pai, cor)
SELECT 'Acao Social', 'EVENTO', '#22C55E'
WHERE NOT EXISTS (
  SELECT 1 FROM public.evento_subtipos WHERE nome = 'Acao Social'
);

-- Add reminder and cancellation fields to inscricoes_eventos
ALTER TABLE public.inscricoes_eventos
ADD COLUMN IF NOT EXISTS lembrete_pagamento_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;

-- Register edge function config for reminders
INSERT INTO public.edge_function_config (function_name, schedule_cron, schedule_description)
VALUES ('inscricoes-lembretes', '*/15 * * * *', 'Verifica lembretes e cancela inscricoes pendentes (a cada 15 min)')
ON CONFLICT (function_name) DO NOTHING;