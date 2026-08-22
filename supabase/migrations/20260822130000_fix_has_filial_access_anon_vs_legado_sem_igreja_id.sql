-- Fix de fundo: has_filial_access() tratava "sem JWT nenhum" (visitante
-- anônimo, anon key sem login) igual a "autenticado com token legado sem
-- o claim igreja_id" — os dois casos batem em get_jwt_igreja_id() IS NULL.
--
-- Achado 2026-08-19 (auditoria de performance RLS): com `SET role anon`
-- e NENHUM request.jwt.claims setado, o shortcut "backwards compatibility"
-- liberava has_filial_access() pra QUALQUER igreja/filial. A mitigação da
-- PR #124 (2026-08-20) fechou o buraco fazendo DROP+CREATE de 9 policies
-- pontuais com `TO authenticated`, mas deixou a causa raiz na função —
-- qualquer outra policy PUBLIC que use has_filial_access() como gate
-- (achadas ~9 no review da própria PR #124: liturgias, liturgia_recursos,
-- aulas, comunicados, liturgia_templates, membro_funcoes, projetos,
-- tags_midias, e times já cobertos por outra correção) continua exposta
-- ao mesmo bypass.
--
-- Fix: o shortcut "igreja_id não definida no JWT = backwards compat" só
-- vale quando existe uma sessão autenticada de verdade (auth.uid() IS NOT
-- NULL — resolve do claim `sub`, presente em qualquer token emitido pelo
-- GoTrue mesmo sem o claim custom igreja_id) OU uma sessão service_role
-- (canal bot/edge functions — mesma detecção de
-- `COALESCE(auth.jwt() ->> 'role', '') = 'service_role'` que
-- fin_resolver_contexto já usa em 20260710120000_fin_core_lancamentos.sql:93
-- pra distinguir o canal service do usuário anônimo). Pra anon de verdade
-- (sem sub, sem role=service_role), o shortcut nunca mais dispara, então
-- a cláusula inteira de igreja_id só casa por igualdade explícita — e sem
-- admin bypass (has_role(NULL,...) é sempre false), o resultado geral vira
-- false.
--
-- ACHADO NO /code-review LOCAL DESTA PRÓPRIA MIGRATION: a 1ª versão do fix
-- só checava auth.uid() IS NOT NULL, sem o branch de service_role — como
-- chatbot-financeiro (supabase/functions/chatbot-financeiro/index.ts:601-602)
-- conecta com SUPABASE_SERVICE_ROLE_KEY (auth.uid() também NULL nesse
-- canal), toda RPC fin_* que rechecka has_filial_access() sem gate de
-- `canal='web'` DEPOIS de fin_resolver_contexto já ter validado o contexto
-- do bot (fin_criar_transferencia, fin_alterar_competencia_grupo,
-- fin_atualizar_lancamento, fin_excluir_lancamento, fin_vincular_lote_*,
-- fin_security_review_filial_access — supabase/migrations/20260731340000,
-- 20260731400000, 20260731300000, 20260731390000) passaria a rejeitar
-- toda transferência/exclusão/edição/vínculo de lote iniciada pelo bot com
-- FIN_TENANT, mesmo pra ator autorizado dentro do próprio tenant.
--
-- Validado em harness Postgres 17 (réplica mínima: app_role, has_role,
-- get_jwt_igreja_id/get_jwt_filial_id, user_filial_access, copiados
-- literalmente das migrations): 11 cenários, 3 reproduzindo o bug original
-- (anon sem claims, anon com o JWT da própria anon key, anon pedindo outro
-- tenant — todos true no comportamento antigo, false no novo), 2 cobrindo
-- o canal service_role/bot (com e sem contexto de igreja no claim — ambos
-- devem continuar true, valida o fix do achado do code-review acima), 5
-- de usuário autenticado legítimo (token legado sem igreja_id, grant
-- explícito, allowlist negando, igreja_id correto/errado no claim), e 1
-- (sugerido em review da PR #132) pinando a comparação de igualdade: JWT
-- no formato da anon key (role=anon) mas com claim igreja_id de OUTRO
-- tenant — continua false via o `_igreja_id = get_jwt_igreja_id()`
-- explícito, não pelo shortcut (que nem dispara, já que o claim está
-- presente) — garante que um refactor futuro não derrube essa comparação
-- sem quebrar teste. Todos idênticos ao comportamento anterior, exceto os
-- 3 casos de anon fechados.
--
-- Não fecha sozinho: liturgias/liturgia_recursos/aulas/comunicados/
-- liturgia_templates/membro_funcoes/projetos/tags_midias ainda são gate
-- único de has_filial_access() em policy PUBLIC (sem TO authenticated) —
-- esse fix já basta pra elas porque o predicado agora nega pra anon
-- estruturalmente, mas midias/midia_tags têm um `OR (true)` literal na
-- policy mesclada da Fase 2 de performance (20260820020000) que não passa
-- por has_filial_access() nenhuma — precisa de fix separado na própria
-- policy, fora do escopo desta migration.
CREATE OR REPLACE FUNCTION public.has_filial_access(_igreja_id UUID, _filial_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- COALESCE(..., false): ver comentário original em
  -- 20260812160000_fix_has_filial_access_null_jwt_bypass.sql — dezenas de
  -- RPCs fazem "IF NOT has_filial_access(...)" e um NULL aqui liberaria
  -- acesso por engano.
  SELECT COALESCE(
    -- Admin global tem acesso total
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      -- Mesmo igreja_id, OU igreja_id não definida no JWT mas a sessão é
      -- de um usuário autenticado de verdade (token legado sem o claim
      -- custom igreja_id — o caso real de backwards compatibility) OU do
      -- canal service_role (bot/edge functions — fin_resolver_contexto já
      -- validou o p_contexto explícito antes de chegar aqui). Sem essas
      -- duas condições, uma sessão anon (sem NENHUM JWT, logo sem claim
      -- `sub` nem role=service_role) também batia aqui e ganhava acesso
      -- irrestrito.
      (
        _igreja_id = public.get_jwt_igreja_id()
        OR (
          public.get_jwt_igreja_id() IS NULL
          AND (
            auth.uid() IS NOT NULL
            OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
          )
        )
      )
      AND (
        -- Admin da igreja tem acesso total na igreja
        has_role(auth.uid(), 'admin_igreja'::app_role)
        OR (
          -- Filial compartilhada (sem dono) ou é a filial primária do JWT
          _filial_id IS NULL
          OR _filial_id = public.get_jwt_filial_id()
          -- Permissão explícita na tabela user_filial_access decide por
          -- conta própria. Escopada por igreja_id E filial_id (achado da
          -- PR #97/#98 — ver 20260812160000).
          OR EXISTS (
            SELECT 1 FROM public.user_filial_access
            WHERE user_id = auth.uid()
            AND igreja_id = _igreja_id
            AND filial_id = _filial_id
            AND can_view = true
          )
          -- Legado: sem filial primária no JWT E sem NENHUMA restrição
          -- granular configurada em user_filial_access NESTA igreja =>
          -- acesso total. Só entra em jogo se a cláusula de igreja_id
          -- acima já decidiu que a sessão é elegível (match direto ou
          -- autenticado sem o claim).
          --
          -- CAVEAT service_role (apontado em review da PR #132): pra
          -- essa sessão auth.uid() é sempre NULL, então o NOT EXISTS
          -- abaixo nunca acha nenhuma row (user_id = NULL não bate nada)
          -- — o shortcut dispara SEMPRE, pra QUALQUER _filial_id, uma vez
          -- que a cláusula de igreja_id já deixou o service_role entrar.
          -- Isso reproduz o comportamento de sempre da função pro bot
          -- (não é regressão desta migration), mas quer dizer que
          -- has_filial_access() não faz scoping de filial nenhum pro
          -- canal service_role — quem trava isso hoje é só
          -- fin_resolver_contexto validando o p_contexto explícito ANTES
          -- de qualquer RPC chamar has_filial_access(). Se uma RPC nova
          -- chamar has_filial_access() sem passar por
          -- fin_resolver_contexto primeiro, este vira um fallback que
          -- libera tudo silenciosamente pro service_role. Tightening
          -- (ex.: exigir p_contexto validado explícito em vez de confiar
          -- cegamente no canal) fica pra sessão dedicada — ver
          -- project-vulnerabilidade-critica-escrita-anonima-has-filial-access
          -- na memória de sessão.
          OR (
            public.get_jwt_filial_id() IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM public.user_filial_access
              WHERE user_id = auth.uid()
              AND igreja_id = _igreja_id
            )
          )
        )
      )
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.has_filial_access(UUID, UUID) IS
  'Verifica acesso de um usuário a uma filial. Admin global/de igreja têm
   acesso total. Caso contrário: igreja_id do claim tem que bater, ou o
   claim estar ausente NUMA SESSÃO AUTENTICADA (token legado sem
   igreja_id) OU NUMA SESSÃO SERVICE_ROLE (canal bot/edge functions,
   mesma detecção que fin_resolver_contexto usa) — auth.uid() IS NOT NULL
   OR role=service_role distingue os dois de uma sessão anon sem JWT
   nenhum (achado 2026-08-19/corrigido 2026-08-22, regressão do canal bot
   pega no /code-review local da própria correção e corrigida antes do
   commit). Dentro da igreja: filial_id NULL (compartilhada) ou igual à
   filial primária do JWT libera; senão, uma row explícita em
   user_filial_access (igreja_id + filial_id + can_view=true) decide; o
   shortcut de "sem filial primária = acesso total" só vale quando o
   usuário não tem NENHUMA row em user_filial_access NESTA igreja
   (comportamento legado — pra service_role, auth.uid() NULL nunca bate
   nenhuma row, então esse shortcut sempre libera, como sempre liberou).';
