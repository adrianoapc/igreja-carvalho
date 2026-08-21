-- ============================================================
-- Fix de achados do Codex (review PR #129) sobre o trigger
-- trg_convite_rsvp_restringe_campos (20260821200000):
--
-- 1) Faltava travar NEW.id — um convidado podia reescrever o
--    próprio PK via PATCH direto (ownership/tenant continuavam
--    passando, já que dependem de pessoa_id/igreja_id/filial_id,
--    não de id).
-- 2) `auth.uid() IS NULL` sozinho não é prova de writer
--    privilegiado — troca pelo padrão já usado em
--    fin_resolver_contexto_super_admin.sql/
--    fin_extratos_duplicata_provavel.sql (`v_is_service`: role
--    'service_role' no JWT E auth.uid() NULL), em vez de confiar
--    só na ausência de uid.
-- 3) (/code-review local, achado adicional) trigger virou
--    allowlist em vez de denylist: em vez de enumerar colunas
--    pra travar (o que deixa uma coluna nova, futura, aberta por
--    padrão até alguém lembrar de travar aqui também), reseta
--    NEW pro valor de OLD inteiro e só reaplica explicitamente as
--    colunas que o convidado tem permissão de mudar
--    (status/motivo_recusa/visualizado_em) — qualquer coluna nova
--    fica travada por padrão.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_convite_rsvp_restringe_campos()
RETURNS TRIGGER AS $$
DECLARE
  v_is_service boolean := COALESCE(auth.jwt() ->> 'role', '') = 'service_role' AND auth.uid() IS NULL;
  v_status text := NEW.status;
  v_motivo_recusa text := NEW.motivo_recusa;
  v_visualizado_em timestamptz := NEW.visualizado_em;
BEGIN
  IF v_is_service OR has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW := OLD;
  NEW.status := v_status;
  NEW.motivo_recusa := v_motivo_recusa;
  NEW.visualizado_em := v_visualizado_em;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
