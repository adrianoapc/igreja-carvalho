-- ============================================================================
-- has_filial_access na RLS de extratos_bancarios (Fase 3/4 pós-#67,
-- docs/arquitetura-financeiro.md §11 / §9.78-§9.79): as 4 policies vigentes
-- (20260117145651) checam só role + igreja_id — zero filial_id. Um
-- tesoureiro restrito a UMA filial lê, via
-- supabase.from("extratos_bancarios").select(...) direto (15 call-sites
-- confirmados em 11 arquivos de src/, todos .select — INSERT/UPDATE/DELETE
-- já revogados de authenticated/anon desde a F7, 20260713160000), o
-- extrato bancário de QUALQUER filial do tenant.
--
-- Fix: ADICIONA has_filial_access(igreja_id, filial_id) às 4 policies,
-- mantendo `igreja_id = get_jwt_igreja_id()` como conjunção separada (não
-- substituindo). Mantém os checks de role como estavam.
--
-- Achado de review (não apanhado no harness original, que só testava
-- dentro do próprio tenant): has_filial_access() dá bypass de FILIAL e de
-- TENANT pra has_role(admin/super_admin) — é o comportamento correto
-- dentro de uma RPC SECURITY DEFINER (onde esse bypass já é uma decisão
-- consciente usada em toda a sessão), mas a policy RLS original desta
-- tabela nunca teve bypass de tenant nenhum — TODO role, inclusive admin,
-- ficava preso a `igreja_id = get_jwt_igreja_id()`. Trocar por só
-- has_filial_access() (versão anterior desta migration) teria dado a
-- admin/super_admin, pela primeira vez, leitura direta de
-- extratos_bancarios de OUTRO TENANT via .select() — alargamento real,
-- não herdado, porque a policy nunca teve esse bypass antes. Fix: manter
-- as DUAS conjunções — `igreja_id = get_jwt_igreja_id() AND has_filial_
-- access(igreja_id, filial_id)` — has_filial_access cobre filial (incl.
-- bypass de admin DENTRO do tenant certo); a igualdade de igreja_id
-- externa preserva a garantia de isolamento de tenant que a policy
-- sempre teve, para todo role sem exceção.
--
-- has_filial_access trata filial_id IS NULL (registro global/compartilhado)
-- como sempre visível dentro do tenant — não quebra o caso intencionalmente
-- cross-filial de VincularExtratoLoteDialog.tsx (lote global sugere
-- candidatos filial_id.eq.X OR filial_id.is.null; "todas as filiais" já
-- manda JWT sem filial_id, que has_filial_access também libera geral).
--
-- Testado em harness Postgres standalone (postgres:15 isolado): SELECT
-- direto sem RPC, SET ROLE authenticated com JWT simulando tesoureiro
-- restrito — rejeita linha de outra filial, aceita própria filial e
-- registro global, JWT sem filial continua vendo tudo da igreja, admin
-- NÃO vê outro tenant (regressão fechada nesta versão).
-- ============================================================================

DROP POLICY IF EXISTS "Ver extratos bancarios" ON public.extratos_bancarios;
CREATE POLICY "Ver extratos bancarios"
ON public.extratos_bancarios
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
  AND public.has_filial_access(igreja_id, filial_id)
);

DROP POLICY IF EXISTS "Inserir extratos bancarios" ON public.extratos_bancarios;
CREATE POLICY "Inserir extratos bancarios"
ON public.extratos_bancarios
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
  AND public.has_filial_access(igreja_id, filial_id)
);

DROP POLICY IF EXISTS "Atualizar extratos bancarios" ON public.extratos_bancarios;
CREATE POLICY "Atualizar extratos bancarios"
ON public.extratos_bancarios
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
  AND public.has_filial_access(igreja_id, filial_id)
)
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
  AND public.has_filial_access(igreja_id, filial_id)
);

DROP POLICY IF EXISTS "Deletar extratos bancarios" ON public.extratos_bancarios;
CREATE POLICY "Deletar extratos bancarios"
ON public.extratos_bancarios
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
  AND public.has_filial_access(igreja_id, filial_id)
);
