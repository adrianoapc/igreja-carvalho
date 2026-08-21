-- transferencias_contas.criado_por referenciava auth.users(id), herdado de
-- antes do refactor fin_* (20260710120000_fin_core_lancamentos.sql). Desde a
-- revogação de escrita direta (20260713141000), toda transferência é criada
-- por fin_criar_transferencia, que grava ator_profile_id (profiles.id,
-- resolvido em fin_resolver_contexto) em criado_por — nunca auth.users.id.
-- Como profiles.id é gerado independente (gen_random_uuid(), não copia
-- auth.users.id), a FK antiga rejeitava toda transferência via RPC (bot e
-- web) com "violates foreign key constraint transferencias_contas_criado_por_fkey".
-- Alinha com o padrão já usado em transacoes_financeiras.criado_por
-- (REFERENCES public.profiles(id)). NOT VALID para não travar o deploy caso
-- existam linhas antigas (pré-refactor) com auth.users.id em criado_por.

ALTER TABLE public.transferencias_contas
  DROP CONSTRAINT transferencias_contas_criado_por_fkey;

ALTER TABLE public.transferencias_contas
  ADD CONSTRAINT transferencias_contas_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES public.profiles(id) ON DELETE SET NULL
  NOT VALID;
