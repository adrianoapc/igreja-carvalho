-- fin_lancar_desagio_antecipacao (migration 20260729170000) sempre gravou
-- origem_registro = 'getnet_antecipacao_desagio' em transacoes_financeiras,
-- mas a CHECK constraint da tabela só permitia 'manual'/'api' — nunca
-- detectado porque ninguém tinha exercitado esse caminho com dado real até
-- agora (achado ao vincular a 1ª antecipação Getnet real, 2026-08-13).

ALTER TABLE public.transacoes_financeiras
  DROP CONSTRAINT transacoes_financeiras_origem_registro_check;

ALTER TABLE public.transacoes_financeiras
  ADD CONSTRAINT transacoes_financeiras_origem_registro_check
  CHECK (origem_registro = ANY (ARRAY['manual'::text, 'api'::text, 'getnet_antecipacao_desagio'::text]));
