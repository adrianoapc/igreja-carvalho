-- ============================================================================
-- has_filial_access na RLS de extratos_bancarios (fatia 2/3 pós-#67,
-- docs/arquitetura-financeiro.md §11 / §9.78-§9.79): as 4 policies vigentes
-- (20260117145651) checam só role + igreja_id — zero filial_id. Um
-- tesoureiro restrito a UMA filial lê, via
-- supabase.from("extratos_bancarios").select(...) direto (15 call-sites
-- confirmados em 11 arquivos de src/, todos .select — INSERT/UPDATE/DELETE
-- já revogados de authenticated/anon desde a F7, 20260713160000), o
-- extrato bancário de QUALQUER filial do tenant.
--
-- Fix: mesma troca já aplicada 2x neste projeto pra exatamente essa classe
-- de bug (fin_audit_log_select em 20260710120000; categorias_financeiras/
-- bases_ministeriais/centros_custo/fornecedores em 20260602195254) —
-- has_filial_access(igreja_id, filial_id) engloba a checagem de igreja,
-- substitui igreja_id = get_jwt_igreja_id() nas 4 policies. Mantém os
-- checks de role como estavam.
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
-- registro global, JWT sem filial continua vendo tudo da igreja (mesmo
-- comportamento documentado das RPCs já corrigidas).
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
  AND public.has_filial_access(igreja_id, filial_id)
)
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
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
  AND public.has_filial_access(igreja_id, filial_id)
);
