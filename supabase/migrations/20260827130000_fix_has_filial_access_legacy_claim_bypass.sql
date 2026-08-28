-- Fecha 2 bypasses reais em has_filial_access() / get_jwt_igreja_id() /
-- get_jwt_filial_id(), achados por /code-review local (agentes de
-- verificação de segurança) contra o estado ATUAL das migrations
-- (20260822130000 em diante), não simulação hipotética:
--
-- BUG 1 — "autenticado sem claim = acesso total a QUALQUER igreja":
-- 20260822130000 corrigiu anon-sem-JWT-nenhum, mas manteve
-- `auth.uid() IS NOT NULL` sozinho como suficiente pro branch de
-- "token legado sem o claim igreja_id". Cadastro público (`src/pages/
-- Auth.tsx` → `supabase.auth.signUp`, sem convite) cria profile via
-- `handle_new_user` (20251208190100) com `igreja_id`/`filial_id` NULL,
-- status='visitante'. `sync_user_jwt_metadata` (20260105114450:41-43)
-- só grava o claim em app_metadata quando o profile JÁ tem
-- igreja_id/filial_id não-nulo — então o JWT de um visitante recém-
-- cadastrado NUNCA ganha o claim, só o `sub` (auth.uid()). Resultado:
-- `has_filial_access(<qualquer_igreja_id>, <qualquer_filial_id>)`
-- retornava `true` pra QUALQUER usuário autocadastrado, pra QUALQUER
-- tenant — sem precisar de convite nem de nenhuma ação administrativa.
--
-- BUG 2 — claim de tenant forjável via user_metadata:
-- `get_jwt_igreja_id()`/`get_jwt_filial_id()` (definição atual,
-- 20260117150559) caem pra `{user_metadata,igreja_id}` /
-- `{user_metadata,filial_id}` como último fallback do COALESCE.
-- `user_metadata` é exatamente o que `supabase.auth.updateUser({data:
-- {...}})` grava — gravável pelo PRÓPRIO usuário autenticado, de
-- qualquer conta, sem privilégio nenhum. Qualquer usuário logado podia
-- chamar `updateUser({data: {igreja_id: '<vítima>', filial_id:
-- '<vítima>'}})` e o próximo JWT emitido satisfaz o branch de
-- igualdade DIRETA de `has_filial_access()` (`_igreja_id =
-- get_jwt_igreja_id()`) — nem precisava do Bug 1, era personificação
-- de tenant completa pra qualquer conta.
--
-- Investigação prévia a este fix (não repetida aqui, ver PR/achados):
-- nenhum código do repo grava `user_metadata.igreja_id`/`filial_id`
-- legitimamente hoje (só `app_metadata`, via
-- `provisionar-admin-igreja`/`sync_user_jwt_metadata`) — remover o
-- fallback do Bug 2 não quebra fluxo nenhum. O branch "autenticado sem
-- claim" É usado de propósito pelo canal `service_role` (bot/edge
-- functions, ver 20260822130000) — esse branch fica INTOCADO aqui, só
-- o branch de usuário autenticado via `auth.uid()` é restrito a
-- comparar contra o `igreja_id` REAL do profile, não mais aceitar
-- qualquer `_igreja_id` passado.
--
-- Fora do escopo desta migration (achados relacionados, não
-- corrigidos aqui — ver docs/guardrails-financeiro.md):
-- - `midias`/`midia_tags` têm uma policy PERMISSIVE com `OR (true)`
--   literal (20260820020000) que bypassa has_filial_access() por
--   completo, causa raiz diferente (bug na policy, não na função) —
--   fix dedicado necessário.
-- - `liturgia_recursos` tem uma 2ª policy SELECT `TO anon,authenticated
--   USING (true)` (20251203233713, "Publico pode ver recursos
--   liturgia" — pro Telão) que torna o gate de has_filial_access()
--   moot pra leitura dessa tabela; parece intencional, precisa
--   confirmação de produto, não decisão técnica unilateral.
-- - `get_current_user_igreja_id()` foi silenciosamente sobrescrita por
--   20260223223125 (fix de recursão em RLS de profiles) e perdeu o
--   fallback `get_jwt_igreja_id()` que `get_current_user_filial_id()`
--   ainda tem — as duas funções irmãs ficaram assimétricas. Não usada
--   por has_filial_access() (que já lê get_jwt_* diretamente), fica
--   como achado separado.
--
-- Achados de review (`@cursoragent`, PR #135) — não bloqueiam o merge,
-- efeito colateral verificado como NÃO alcançável hoje, não corrigidos
-- nesta migration:
-- - `has_filial_access(NULL, NULL)` passa de `true` pra `false` pra um
--   visitante autocadastrado sem tenant. A policy de UPDATE de
--   `profiles` (`perf_merge_002_update_auth`, última definição em
--   20260821200000) não tem fallback de "própria linha, tenant
--   qualquer" — só `(auth.uid() = user_id) AND has_filial_access(...)`
--   — então esse visitante também não consegue mais fazer PATCH no
--   próprio profile (avatar, `deve_trocar_senha`, etc.) via
--   `has_filial_access`. Investigação (agente dedicado) confirmou que
--   isso é INALCANÇÁVEL hoje por 2 motivos independentes e já
--   existentes (nenhum dos dois introduzido por esta migration):
--   `Perfil.tsx:149` tem um guard client-side (`if (!profile?.id ||
--   !igrejaId) return`) que trava a página inteira em loading eterno
--   pra usuário sem `igreja_id`, antes de qualquer RLS entrar em jogo;
--   e `ForcedPasswordChange.tsx` só é alcançado quando
--   `deve_trocar_senha=true`, que autocadastro nunca seta (só
--   `criar_usuario_membro`/`resetar_senha_usuario_membro`, que exigem
--   um profile PRÉ-EXISTENTE com `igreja_id` real). Fica documentado
--   porque é proteção incidental, não desenhada — um fix futuro no
--   guard de `Perfil.tsx` reabriria isso de verdade, já que a policy
--   de UPDATE em si não tem fallback próprio.
-- - `profiles.igreja_id`/`filial_id` viraram raiz de confiança direta
--   pro shortcut de claim ausente (esta migration). RLS de UPDATE por
--   dono não restringe QUAIS colunas mudam (guardrail já documentado,
--   ver `docs/guardrails-financeiro.md` item RLS-UPDATE); não existe
--   trigger `BEFORE UPDATE` travando `igreja_id`/`filial_id` em
--   `profiles` no padrão de `trg_convite_rsvp_restringe_campos`
--   (RSVP de convite). Como `sync_user_jwt_metadata` espelha profile →
--   `app_metadata`, um PATCH bem-sucedido nessas 2 colunas vira claim
--   de verdade. Defesa em profundidade, PR dedicada — fora do escopo
--   aqui.

CREATE OR REPLACE FUNCTION public.get_jwt_igreja_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  -- Fallback pra user_metadata REMOVIDO (era o Bug 2, achado real de
  -- /code-review local): user_metadata é gravável pelo próprio usuário
  -- via supabase.auth.updateUser({data:{...}}), então servia de vetor
  -- de personificação de tenant. Só claim/app_metadata seguem —
  -- ambos exigem controle do servidor (custom access token hook /
  -- admin API / trigger sync_user_jwt_metadata).
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'igreja_id'), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,igreja_id}'), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.get_jwt_filial_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  -- Mesmo fix do get_jwt_igreja_id() acima — ver comentário lá.
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.filial_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'filial_id'), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,filial_id}'), '')::uuid
  );
$$;

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
      -- Mesmo igreja_id, OU (igreja_id não definida no JWT E [sessão de
      -- usuário autenticado de verdade CUJO PROFILE REALMENTE PERTENCE
      -- a essa igreja (token legado sem o claim custom, mas ainda
      -- restrito ao próprio tenant) OU canal service_role]).
      --
      -- FIX (achado real de /code-review local, corrigindo
      -- 20260822130000): a condição anterior aceitava QUALQUER
      -- `auth.uid() IS NOT NULL` como prova de "sessão legada", sem
      -- checar se o profile dessa sessão pertence de verdade a
      -- `_igreja_id`. Cadastro público (`src/pages/Auth.tsx`) cria
      -- profile com igreja_id/filial_id NULL e nunca ganha o claim
      -- (sync_user_jwt_metadata só sincroniza quando o profile já tem
      -- valor não-nulo) — então qualquer usuário recém-cadastrado, sem
      -- convite nenhum, batia nesse branch pra QUALQUER `_igreja_id`
      -- passado. Comparar contra o igreja_id REAL do profile fecha
      -- isso: usuário sem igreja (profile.igreja_id NULL) nunca bate
      -- `_igreja_id = NULL`, pra nenhum `_igreja_id` real; usuário
      -- legado de verdade (profile.igreja_id preenchido, claim ainda
      -- não sincronizado no JWT) continua batendo, só que agora
      -- restrito ao PRÓPRIO tenant, não a qualquer um.
      -- Nota de robustez (achado real de `/code-review` local, review da
      -- PR #135): o `AND` da filial fica DENTRO deste mesmo `OR (`, não
      -- fora dele — a versão anterior fechava este parêntese antes do
      -- `AND`, funcionando só porque `AND` tem precedência maior que
      -- `OR` em SQL (`A OR B OR C AND D` ≡ `A OR B OR (C AND D)`).
      -- Correto hoje, mas frágil a um refactor futuro que envolva os
      -- argumentos do `COALESCE` de outro jeito — aninhar explícito
      -- remove a dependência de precedência.
      (
        (
          _igreja_id = public.get_jwt_igreja_id()
          OR (
            public.get_jwt_igreja_id() IS NULL
            AND (
              (
                auth.uid() IS NOT NULL
                AND _igreja_id = (
                  SELECT p.igreja_id FROM public.profiles p
                  WHERE p.user_id = auth.uid()
                  LIMIT 1
                )
              )
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
            -- acima já decidiu que a sessão é elegível (match direto,
            -- legado com profile real, ou service_role) — com o fix acima,
            -- _igreja_id já está garantidamente correto pro caso legado, não
            -- mais um valor arbitrário.
            --
            -- CAVEAT service_role (apontado em review da PR #132, mantido
            -- sem alteração nesta migration): pra essa sessão auth.uid() é
            -- sempre NULL, então o NOT EXISTS abaixo nunca acha nenhuma row
            -- (user_id = NULL não bate nada) — o shortcut dispara SEMPRE,
            -- pra QUALQUER _filial_id, uma vez que a cláusula de igreja_id
            -- já deixou o service_role entrar. Isso reproduz o
            -- comportamento de sempre da função pro bot (não é regressão
            -- desta migration), mas quer dizer que has_filial_access() não
            -- faz scoping de filial nenhum pro canal service_role — quem
            -- trava isso hoje é só fin_resolver_contexto validando o
            -- p_contexto explícito ANTES de qualquer RPC chamar
            -- has_filial_access(). Se uma RPC nova chamar
            -- has_filial_access() sem passar por fin_resolver_contexto
            -- primeiro, este vira um fallback que libera tudo silenciosamente
            -- pro service_role.
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
      )
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.has_filial_access(UUID, UUID) IS
  'Verifica acesso de um usuário a uma filial. Admin global/de igreja têm
   acesso total. Caso contrário: igreja_id do claim tem que bater, ou o
   claim estar ausente E (a) sessão autenticada cujo PROFILE realmente
   pertence a essa igreja (token legado, achado/fix real de
   /code-review local em 20260827130000 — antes bastava auth.uid() IS
   NOT NULL sozinho, o que liberava acesso total a qualquer tenant pra
   usuário autocadastrado sem convite) ou (b) canal service_role
   (bot/edge functions — fin_resolver_contexto valida o contexto antes).
   Filial: acesso de admin_igreja, filial compartilhada (NULL), filial
   primária do JWT, permissão explícita em user_filial_access, ou legado
   sem filial primária E sem restrição granular configurada.';
