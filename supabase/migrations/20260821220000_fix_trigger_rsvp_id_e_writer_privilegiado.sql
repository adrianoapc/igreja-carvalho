-- ============================================================
-- Fix de 2 achados do Codex (review PR #129) sobre o trigger
-- trg_convite_rsvp_restringe_campos (20260821200000):
--
-- 1) Faltava travar NEW.id — um convidado podia reescrever o
--    próprio PK via PATCH direto (ownership/tenant continuavam
--    passando, já que dependem de pessoa_id/igreja_id/filial_id,
--    não de id).
-- 2) auth.uid() IS NULL (conexão service_role/manutenção direta,
--    que já bypassa RLS) caía no branch "não-admin" — has_role
--    (NULL, 'admin') retorna false — e qualquer correção
--    administrativa legítima feita fora de uma sessão de usuário
--    tinha os campos estruturais revertidos SILENCIOSAMENTE
--    (sem erro, parecia ter funcionado). Como a policy de UPDATE
--    já exige pessoa_id/has_role ligados a auth.uid() pra passar
--    o RLS, um UPDATE que chega no trigger com auth.uid() NULL só
--    pode vir de um writer que já bypassou RLS (service_role/
--    superuser) — nunca de um convidado real.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_convite_rsvp_restringe_campos()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL OR has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.evento_id := OLD.evento_id;
  NEW.pessoa_id := OLD.pessoa_id;
  NEW.igreja_id := OLD.igreja_id;
  NEW.filial_id := OLD.filial_id;
  NEW.enviado_em := OLD.enviado_em;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
