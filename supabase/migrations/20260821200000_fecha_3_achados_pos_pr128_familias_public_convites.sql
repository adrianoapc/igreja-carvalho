-- ============================================================
-- MIGRATION: fecha 3 achados da auditoria pós-PR #126/#127/#128
-- (RLS FOR-clause + performance nas 7 tabelas restauradas)
--
-- 1) familias SELECT: restaura o relacionamento próprio do membro.
--    A migration 20260105120000 tentou isso via
--    "ALTER POLICY ... USING (responsavel_id IN (...))", mas
--    `familias` nunca teve coluna `responsavel_id` (só
--    pessoa_id/familiar_id) — o ALTER POLICY falhou silenciosamente
--    (sem derrubar o resto do arquivo, que já tinha outros
--    ALTER POLICY aplicados normalmente). Resultado: desde
--    janeiro/2026, MinhaFamilia.tsx, Perfil.tsx e FamilyWallet.tsx
--    retornam vazio pra qualquer usuário não-admin. Mergeado
--    direto em perf_merge_000_select_auth (não como policy
--    separada) pra não reabrir multiple_permissive_policies.
--
-- 2) Estreita PUBLIC -> authenticated nas 6 policies apontadas
--    pelo advisor real (profiles INSERT/SELECT/UPDATE, familias
--    INSERT, visitante_contatos SELECT/UPDATE). Nenhuma dessas
--    policies é alcançável por `anon` ou por role interno do
--    Supabase hoje — todas se auto-restringem em
--    "auth.uid() IS NOT NULL" (direto ou via has_role/
--    has_filial_access), e esse GUC só é populado pelo PostgREST
--    numa requisição já autenticada; anon/authenticator/
--    dashboard_user/cli_login_postgres/supabase_privileged_role
--    não têm rolbypassrls e não passam por esse predicado.
--    service_role e o cadastro público (edge function
--    cadastro-publico, que conecta com SUPABASE_SERVICE_ROLE_KEY)
--    bypassam RLS de qualquer forma. Estreitar sozinho não fecha
--    o advisor nessas 5 (ficaria authenticated+authenticated) —
--    por isso cada PUBLIC é mergeada (OR do predicado) na policy
--    authenticated irmã da mesma tabela+ação, e a PUBLIC é
--    dropada.
--
-- 3) eventos_convites: restaura as policies de convidado (ver e
--    responder/RSVP o próprio convite) que existiam na migration
--    original (20251229230859) mas sumiram de produção sem DROP
--    rastreado em nenhuma migration (mesmo padrão de edição
--    manual não capturada já visto em outras tabelas). Mergeadas
--    nas policies de admin/lider existentes (renomeadas pra
--    refletir o escopo real) em vez de criadas como policies
--    novas, também pra não abrir multiple_permissive_policies
--    nessa tabela.
--
-- Todos os testes funcionais (membro vê só o próprio registro,
-- não acessa o alheio; admin mantém visão total; anon continua
-- em 0 linhas) foram validados num harness Postgres real carregado
-- com o dump do schema de produção antes desta migration.
-- ============================================================

-- ---------- 1. familias SELECT ----------
ALTER POLICY "perf_merge_000_select_auth" ON public.familias
  USING (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR (
      (
        pessoa_id IN (SELECT id FROM profiles WHERE user_id = (select auth.uid()))
        OR familiar_id IN (SELECT id FROM profiles WHERE user_id = (select auth.uid()))
      )
      AND has_filial_access(igreja_id, filial_id)
    )
  );

-- ---------- 2. Estreita PUBLIC -> authenticated (merge nas irmãs) ----------

-- profiles INSERT
ALTER POLICY "perf_merge_001_insert_auth" ON public.profiles
  WITH CHECK (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR ((user_id IS NULL) OR (user_id = (select auth.uid())))
    OR ((select auth.uid()) = user_id)
    OR (
      ((select auth.uid()) IS NOT NULL) AND (user_id IS NULL) AND (familia_id IS NOT NULL)
      AND (familia_id = get_user_familia_id((select auth.uid())))
    )
    OR (
      ((select auth.uid()) = user_id) AND ((select auth.uid()) IS NOT NULL) AND (user_id IS NOT NULL)
    )
  );
DROP POLICY "perf_merge_001_insert_pub" ON public.profiles;

-- profiles SELECT
ALTER POLICY "perf_merge_000_select_auth" ON public.profiles
  USING (
    (has_role((select auth.uid()), 'tecnico'::app_role) AND (igreja_id = get_current_user_igreja_id()))
    OR (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR (((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id))
    OR (
      ((select auth.uid()) IS NOT NULL)
      AND ((user_id = (select auth.uid())) OR ((familia_id IS NOT NULL) AND (familia_id = get_user_familia_id((select auth.uid())))))
    )
  );
DROP POLICY "members_can_view_family_members" ON public.profiles;

-- profiles UPDATE
ALTER POLICY "perf_merge_002_update_auth" ON public.profiles
  USING (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR (((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id))
    OR (
      ((select auth.uid()) IS NOT NULL) AND (user_id IS NULL) AND (familia_id IS NOT NULL)
      AND (familia_id = get_user_familia_id((select auth.uid())))
    )
  )
  WITH CHECK (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR (((select auth.uid()) = user_id) AND has_filial_access(igreja_id, filial_id))
    OR (
      ((select auth.uid()) IS NOT NULL) AND (user_id IS NULL) AND (familia_id IS NOT NULL)
      AND (familia_id = get_user_familia_id((select auth.uid())))
    )
  );
DROP POLICY "members_can_update_dependents" ON public.profiles;

-- familias INSERT
ALTER POLICY "perf_merge_001_insert_auth" ON public.familias
  WITH CHECK (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR (
      ((select auth.uid()) IS NOT NULL)
      AND (pessoa_id IN (SELECT id FROM profiles WHERE user_id = (select auth.uid())))
    )
  );
DROP POLICY "members_can_create_family_relationships" ON public.familias;

-- visitante_contatos SELECT
ALTER POLICY "perf_merge_000_select_auth" ON public.visitante_contatos
  USING (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR ((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id))
    OR (
      (
        has_role((select auth.uid()), 'admin'::app_role)
        OR has_role((select auth.uid()), 'super_admin'::app_role)
        OR has_role((select auth.uid()), 'admin_igreja'::app_role)
        OR has_role((select auth.uid()), 'pastor'::app_role)
        OR has_role((select auth.uid()), 'lider'::app_role)
        OR has_role((select auth.uid()), 'secretario'::app_role)
        OR has_role((select auth.uid()), 'tesoureiro'::app_role)
        OR has_role((select auth.uid()), 'professor'::app_role)
      )
      AND has_filial_access(igreja_id, filial_id)
    )
  );
DROP POLICY "Church staff podem ver contatos agendados da filial" ON public.visitante_contatos;

-- visitante_contatos UPDATE
ALTER POLICY "perf_merge_002_update_auth" ON public.visitante_contatos
  USING (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR ((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id))
    OR (
      (
        has_role((select auth.uid()), 'admin'::app_role)
        OR has_role((select auth.uid()), 'super_admin'::app_role)
        OR has_role((select auth.uid()), 'admin_igreja'::app_role)
        OR has_role((select auth.uid()), 'pastor'::app_role)
        OR has_role((select auth.uid()), 'lider'::app_role)
        OR has_role((select auth.uid()), 'secretario'::app_role)
        OR has_role((select auth.uid()), 'tesoureiro'::app_role)
        OR has_role((select auth.uid()), 'professor'::app_role)
      )
      AND has_filial_access(igreja_id, filial_id)
    )
  )
  WITH CHECK (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR ((membro_responsavel_id = (select auth.uid())) AND has_filial_access(igreja_id, filial_id))
    OR (
      (
        has_role((select auth.uid()), 'admin'::app_role)
        OR has_role((select auth.uid()), 'super_admin'::app_role)
        OR has_role((select auth.uid()), 'admin_igreja'::app_role)
        OR has_role((select auth.uid()), 'pastor'::app_role)
        OR has_role((select auth.uid()), 'lider'::app_role)
        OR has_role((select auth.uid()), 'secretario'::app_role)
        OR has_role((select auth.uid()), 'tesoureiro'::app_role)
        OR has_role((select auth.uid()), 'professor'::app_role)
      )
      AND has_filial_access(igreja_id, filial_id)
    )
  );
DROP POLICY "Church staff podem gerenciar contatos agendados da filial" ON public.visitante_contatos;

-- ---------- 3. eventos_convites: restaura acesso do próprio convidado ----------

ALTER POLICY "Admin e lider podem ver todos os convites" ON public.eventos_convites
  RENAME TO "Admin, lider e convidado podem ver convites";
ALTER POLICY "Admin, lider e convidado podem ver convites" ON public.eventos_convites
  USING (
    (
      (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'lider'::app_role))
      AND has_filial_access(igreja_id, filial_id)
    )
    OR (
      pessoa_id IN (SELECT id FROM profiles WHERE user_id = (select auth.uid()))
      AND has_filial_access(igreja_id, filial_id)
    )
  );

ALTER POLICY "Admin pode atualizar convites" ON public.eventos_convites
  RENAME TO "Admin e convidado podem atualizar convites";
ALTER POLICY "Admin e convidado podem atualizar convites" ON public.eventos_convites
  USING (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR (
      pessoa_id IN (SELECT id FROM profiles WHERE user_id = (select auth.uid()))
      AND has_filial_access(igreja_id, filial_id)
    )
  )
  WITH CHECK (
    (has_role((select auth.uid()), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
    OR (
      pessoa_id IN (SELECT id FROM profiles WHERE user_id = (select auth.uid()))
      AND has_filial_access(igreja_id, filial_id)
    )
  );

-- Trava colunas estruturais no RSVP do convidado (achado Codex, review
-- PR #129): o WITH CHECK acima só valida linha/tenant, não QUAIS
-- colunas mudaram — sem isso, um PATCH direto via PostgREST (fora do
-- ConvitesPendentesWidget) poderia mover o convite pra outro evento
-- (evento_id), reatribuir pessoa_id, ou trocar igreja_id/filial_id,
-- desde que a linha resultante ainda passasse no check. O trigger
-- força de volta ao valor antigo qualquer coluna estrutural quando
-- quem está escrevendo não é admin — RSVP legítimo só muda
-- status/motivo_recusa/visualizado_em.
CREATE OR REPLACE FUNCTION public.trg_convite_rsvp_restringe_campos()
RETURNS TRIGGER AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.evento_id := OLD.evento_id;
  NEW.pessoa_id := OLD.pessoa_id;
  NEW.igreja_id := OLD.igreja_id;
  NEW.filial_id := OLD.filial_id;
  NEW.enviado_em := OLD.enviado_em;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_convite_rsvp_restringe_campos ON public.eventos_convites;
CREATE TRIGGER trigger_convite_rsvp_restringe_campos
  BEFORE UPDATE ON public.eventos_convites
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_convite_rsvp_restringe_campos();
