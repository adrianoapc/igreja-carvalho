# Onde a mudança pousa: worktree e branch

**Invariante deste repo:** o checkout primário (`/Development/igreja-
carvalho`) fica sempre em `main` e sempre limpo. Todo trabalho de feature
mora num worktree próprio, um por PR:

```bash
git fetch origin
git worktree add .claude/worktrees/<nome> -b <branch> origin/main
```

A branch nasce de `origin/main`, nunca do HEAD atual — foi assim que um PR
carregou o diff de outro por engano de base.

Sem essa invariante não existe nada pra conferir: o primário flutua entre
branches, cada sessão nova abre nele herdando o que a sessão anterior
deixou, e a única pergunta que importa ("essa edição vai pousar no PR
certo?") não tem resposta observável. Achado ao vivo nesta sessão
(2026-09-04): o checkout primário estava em `feat/whatsapp-webhook-
skeleton` (5 commits à frente de `origin/main`, work-in-progress real, não
lixo) enquanto 3 outros worktrees (`fix-midias-or-true`,
`fix-supabase-erros-alertas`, `reconciliacao-extratos`) já existiam em
paralelo — exatamente o estado que este guardrail existe pra prevenir, e a
motivação direta de trazê-lo pra este repo.

**Antes de editar qualquer arquivo**, confirme os três:

1. `git worktree list` — existe worktree para este trabalho? Um worktree com
   WIP não commitado é trabalho de outra sessão, não mexa nele.
2. `git branch --show-current` — é a branch do PR que você vai atualizar?
   Para PR já aberto, confira com `gh pr view <n> --json headRefName`.
3. `git status --short` — sujeira que você não reconhece é de outra sessão.

Dois mecanismos aplicam isso automaticamente, e nenhum substitui os três
comandos acima:

- **Statusline** (`.claude/statusline.sh`): mostra worktree, branch,
  ahead/behind e nº de arquivos sujos o tempo todo; marca `⚠ (primário)`
  quando o checkout principal não está em `main`. Não é ligada pelo
  settings do projeto — statusline é preferência pessoal e vale para todo
  repo, então instale copiando: `cp .claude/statusline.sh
  ~/.claude/statusline.sh` e aponte `"statusLine": {"type": "command",
  "command": "bash ~/.claude/statusline.sh"}` no seu `~/.claude/settings.json`.
- **Hook bloqueante** (`.claude/hooks/branch-guard.sh`, `PreToolUse` em
  `Write|Edit` **e** `Bash`): registra a branch de cada worktree que a
  sessão toca e recusa a escrita se aquele worktree trocou de branch depois
  (estado em `.claude/hooks/.branch-guard-state/`, gitignored — a mensagem
  de recusa diz o `rm` exato pra liberar quando a troca for intencional).
  Em `Write|Edit` também recusa qualquer escrita num worktree em
  `main`/`master`. No matcher `Bash`, só dispara pra um subconjunto
  deliberadamente conservador de comandos que mutam git/arquivo (`git add/
  commit/push/merge/rebase/reset/checkout/switch/stash/rm/mv/cherry-pick/
  revert/clean`, `sed -i`, redirecionamento `>`/`>>`) resolvendo `cd`/`git
  -C` líder da mesma forma já testada em `pre-commit-checks.sh` — comando
  de leitura passa direto. Limitações conhecidas documentadas no fim do
  próprio arquivo (não é cobertura exaustiva de "todo comando que escreve",
  e um único comando que troca de branch E escreve na mesma invocação não é
  recusado por essa combinação específica). `--self-test` roda e2e contra
  worktrees git reais em diretório temporário.

Ao terminar: `git worktree remove <path>` só depois do merge. Worktree
limpo e sem commits à frente de `main` é lixo; worktree sujo é trabalho de
alguém.

# Guardrails de processo (review, CI, dataviz)

Antes de commitar ou abrir PR, leia
[`docs/guardrails-processo.md`](docs/guardrails-processo.md) (nasceu de
auditoria de 98 PRs desde maio/2026 — detalhe completo com PRs de origem
de cada padrão no próprio arquivo). Resumo:

- **`/code-review` e `/security-review` não são opcionais na prática**: uma
  auditoria (2026-08-26) achou que 53% das PRs revisadas só receberam
  "usage limit reached" do Cursor Bugbot — nenhuma revisão real. As PRs
  #57–#64 (bug real de sinal financeiro) não tiveram revisão nenhuma.
  Rode as duas skills local antes de `gh pr create`; o hook
  `pr-review-reminder.sh` lembra, mas não bloqueia (não dá pra verificar
  que a skill rodou de fato).
- **Hook de commit já roda lint+typecheck+testes automaticamente**
  (`.claude/hooks/pre-commit-checks.sh`, via `PreToolUse` em
  `.claude/settings.json`) — bloqueia `git commit` se falhar. Roda contra
  o snapshot do índice (não o working tree) e honra `git -C`. Só vale
  dentro de sessão Claude Code com esse settings.json carregado; não
  substitui CI.
- **CI (`pattern-guardrails.yml`) é o gate real**, independente de
  ferramenta: grep só numa janela em torno dos hunks do diff, bloqueando
  padrões de bug já recorrentes (`.eq("filial_id"` — o `.eq` em si exclui
  globais, um `.or(...)` por perto não basta porque o PostgREST ANDa;
  `.delete()`/`.update()` sem `{count:"exact"}` **nesta** call, não numa
  irmã; `STATUS_COLOR` como `color:`). Detectores + `--self-test` em
  `.github/scripts/pattern-guardrails.sh`. `migration-harness.yml` (harness
  de Postgres aplicando toda migration do zero antes do merge) foi
  desenhado mas **retirado** — a história de migrations tem drift
  conhecido (`itens_reembolso` nunca criada, `times_culto` referenciada
  após removida) que faz `supabase db reset` falhar sempre; corrigir isso
  é sessão dedicada, nunca resetando/dropando/truncando prod.
- **Gráfico novo**: usar `src/lib/chartPalette.ts` (série categórica) ou
  `statusPalette.ts` (pill/status) — nunca hex hardcoded. Consultar a
  skill `dataviz` pra paleta sequencial/divergente ou forma de gráfico.
  8+ paletas hex divergentes já foram achadas espalhadas por dashboards
  antes desse guardrail existir.
- **`main` tem branch protection**: sem push direto, PR obrigatória,
  status checks (`docs_guard`, `pattern_guardrails`) precisam passar. Não
  exige aprovação humana (projeto mantido por 1 dev) — o gate é CI verde,
  não review de terceiro.

# Guardrails — módulo financeiro

Antes de escrever ou revisar qualquer RPC `fin_*`, trigger, migration ou tela
que mexa em contas/transações/formas de pagamento/categorias, leia
[`docs/guardrails-financeiro.md`](docs/guardrails-financeiro.md). Resumo do
que está lá (detalhe completo, com o `§9.NN` de origem de cada regra, no
próprio arquivo):

- **Regra de ouro**: as 7 tabelas core do financeiro têm `INSERT/UPDATE/
  DELETE` revogados de `authenticated`/`anon` — toda escrita passa por RPC
  `fin_*` `SECURITY DEFINER`. Nunca reintroduzir escrita direta.
- **Filial compartilhada** (`filial_id IS NULL`): use `.or("filial_id.eq.X,
  filial_id.is.null")`, nunca `.eq()` puro, em qualquer query que deva
  enxergar registros globais.
- **RPC `SECURITY DEFINER`**: sempre resolver `igreja_id` via
  `fin_resolver_contexto`, validar `has_filial_access` contra a filial
  EFETIVA, e repassar o contexto (não `NULL`) pra RPCs aninhadas.
  Arrays JSON irmãos (ex.: `transacao_ids` + `divisoes`) precisam da
  mesma validação; `filial_id` de audit/relatório ≠ filial de junção
  (ator vs recurso). Lookups irmãos em `user_filial_access` (`EXISTS`
  grant vs `NOT EXISTS` legado) precisam do mesmo `igreja_id` — unique
  em `(user_id, filial_id)` não substitui o predicado de tenant.
  O 2º argumento de `fin_resolver_contexto` (`p_flag_bot`) **só vale no
  canal bot** — no JWT, tesoureiro sem o flag de `profiles` ainda passa.
  Escrita que exige o flag no web precisa checar `autorizado_lancar_*`
  no JWT (ou não expor a ação).
- **`has_filial_access()`**: o shortcut de "`igreja_id` ausente no JWT =
  backwards compat" só dispara com `auth.uid() IS NOT NULL` (sessão
  autenticada de verdade) OU `role=service_role` (canal bot/edge
  functions, mesma detecção que `fin_resolver_contexto` já usa) — sem
  isso, `anon` sem NENHUM JWT também batia no shortcut e ganhava acesso
  irrestrito (corrigido 2026-08-22). **Cuidado ao endurecer esse tipo de
  shortcut**: a 1ª versão só checava `auth.uid()`, sem o branch de
  `service_role` — como o bot conecta com a service role key (`auth.uid()`
  também NULL nesse canal), quebrava toda RPC `fin_*` que rechecka
  `has_filial_access()` sem gate de `canal='web'` depois de
  `fin_resolver_contexto` já ter validado o contexto do bot; achado no
  `/code-review` local antes do commit. Qualquer policy `PUBLIC`/sem `TO
  authenticated` que usa a função como único gate ainda depende só dela —
  não confiar em `TO authenticated` como a defesa primária. **Pro
  `service_role`, a função não faz scoping de filial nenhum** (quem
  chama sempre bate no shortcut legado, já que `auth.uid()` NULL nunca
  acha row em `user_filial_access`) — quem trava isso é só
  `fin_resolver_contexto` validando `p_contexto` ANTES da RPC chamar
  `has_filial_access()`; RPC nova que pular essa validação vira
  fallback que libera tudo pro bot. **O shortcut `auth.uid() IS NOT
  NULL` sozinho (acima) ainda era exploitável**: cadastro público sem
  convite cria usuário sem `igreja_id` no profile/JWT, e o shortcut
  aceitava esse `auth.uid()` como prova de "legado" pra QUALQUER
  `_igreja_id` alvo — bastava se autocadastrar pra ganhar acesso a
  qualquer tenant. Corrigido (2026-08-27) comparando contra o
  `igreja_id` REAL do profile em vez de aceitar qualquer alvo.
  Separadamente, `get_jwt_igreja_id()`/`get_jwt_filial_id()` liam
  `user_metadata` como fallback — gravável pelo próprio cliente via
  `supabase.auth.updateUser({data:{...}})`, permitindo forjar o claim
  de tenant direto; fallback removido. **Nenhum código legítimo grava
  `user_metadata.igreja_id`/`filial_id`** — só `app_metadata`,
  server-side; não reintroduzir esse fallback achando que "cobre mais
  casos". Harness commitado em `supabase/tests/
  has_filial_access_test.sql` (11 cenários, fail-fast) — rodar de novo
  a cada mudança nessa função, não confiar só em revisão visual. Ver
  `docs/guardrails-financeiro.md` item M.9 pros 2 achados residuais do
  review (`has_filial_access(NULL,NULL)` bloqueando PATCH de profile
  de visitante — hoje inalcançável por guard de UI não relacionado,
  não confiar nisso como proteção desenhada; falta trigger travando
  `igreja_id`/`filial_id` em `profiles`).
- **`origem_registro`**: literal novo numa RPC precisa da CHECK
  constraint na mesma PR (`manual`/`api`/`getnet_antecipacao_desagio`).
- **Ação de escrita nova** num card que já gateia irmãs por filial
  efetiva usa o mesmo gate; ID exposto por RPC de leitura só sai com
  `has_filial_access` no recurso alvo.
- **Trigger de saldo de conta**: sempre recalcula do zero a partir de
  `transacoes_financeiras` — nunca soma/subtrai incrementalmente. Dispara em
  INSERT/UPDATE/DELETE (sem `OF <colunas>`, statement-level com transition
  tables) — nenhuma RPC precisa "tratar saldo" manualmente.
- **Concorrência**: ordem determinística de lock (`ORDER BY id`), lock mais
  fraco possível (`FOR NO KEY UPDATE`), trave antes de ler numa statement
  separada (READ COMMITTED dá snapshot novo por statement).
- **Testing de SQL**: nunca confiar só em `deno check`/`tsc` — testar fix de
  backend num harness Postgres real (Docker) antes de commitar; concorrência
  exige 2 sessões `psql` de verdade, não simulação sequencial.
- **Processo de PR**: 1 fase = 1 PR, harness completo antes de abrir, `/code-
  review` local antes do 1º `@codex review`, batelar fixes antes de
  re-disparar review (cada disparo rescaneia a PR inteira).
- **Paleta de status**: `STATUS_COLOR` em `statusPalette.ts` é fundo de
  pill, não tinta — nunca `color: STATUS_COLOR` em card claro (`warning`
  falha WCAG 3:1). Use `pillStyle(tone)`.
- **Canal WhatsApp**: erro de RPC/Postgres não vai cru pra conversa
  (mapear `FIN_*`, resto genérico; raw só no log). OCR sem CPF/CNPJ
  reusa fornecedor por nome — não criar "Shopee" duplicado a cada print.
- **Renomear migration nunca-aplicada** (fix de colisão de timestamp):
  `grep -l` por toda função que o arquivo redefine, comparar contra
  QUALQUER migration mais recente que também a redefina (aplicada ou
  não) e mesclar os corpos — senão o `CREATE OR REPLACE` da renomeada
  roda por último e reverte silenciosamente a mais recente (sem erro,
  sem warning). PR mergeada em `main` **não** garante deploy aplicado —
  `supabase db push` recusa o lote inteiro por timestamp fora de ordem
  sem alertar além do X no GitHub Actions; checar `gh run list
  --workflow=supabase-deploy.yml` antes de confiar num Advisor achado
  "já corrigido".
- **`REVOKE ALL ... FROM anon` não fecha nada** — `EXECUTE` é concedido
  a `PUBLIC` por padrão, e `anon`/`authenticated` herdam via `PUBLIC`,
  não por grant próprio. Só `REVOKE ... FROM PUBLIC` fecha de verdade;
  revogar de um role nomeado é no-op se `PUBLIC` ainda segura o acesso.
  Confirmar sempre com `supabase db advisors --linked` (não o cache do
  dashboard).
- **`CREATE POLICY` sem `FOR` vira `FOR ALL`** — restaurar sempre com
  `git log -S` pra achar o `FOR` original. Gate de UI pra ação
  destrutiva atrás de uma policy `has_role(admin)` precisa aceitar o
  MESMO conjunto de roles que a função (`admin`/`admin_igreja`/
  `admin_filial`, não só o `isAdmin` genérico do frontend). `.delete()`
  sem `{ count: "exact" }` mostra sucesso mesmo quando o RLS nega.
- **`ALTER POLICY` numa coluna inexistente falha silenciosamente** sem
  derrubar o resto do arquivo de migration (não roda em transação
  explícita) — a policy afetada fica órfã na definição anterior (ou
  simplesmente some, se removida manualmente depois). Só aparece
  comparando `pg_policies` real (`supabase db dump --linked`) contra a
  intenção documentada da migration, nunca por `deno check`/`tsc`.
- **RLS de `UPDATE` por dono da linha não restringe QUAIS colunas
  mudam** — `USING`/`WITH CHECK` só validam a linha, não o payload. Um
  PATCH direto via PostgREST pode alterar qualquer coluna (incluindo
  FKs estruturais) desde que o resultado final ainda passe no mesmo
  check de dono. Ação legítima que só deveria tocar 1-2 colunas precisa
  de um trigger `BEFORE UPDATE` (ou RPC dedicada) que trave o resto.

Este arquivo é o resumo. O detalhe (com exemplos de bug real por item) está em
`docs/guardrails-financeiro.md`, que cresce a cada rodada de review que achar
um padrão novo — atualize os dois juntos.

# Mandatory ADR Phase Workflow

Ao implementar uma fase de uma ADR aceita (ou qualquer mudança grande o
suficiente pra merecer fases — ver `docs/development/change-lifecycle.md`
pra quando isso se aplica), NÃO comece editando código de implementação
direto.

O fluxo completo, incluindo o bloco Discovery/Decision que produz uma ADR
aceita e o que acontece depois do review, está mapeado em
`docs/development/change-lifecycle.md`.

```
ADR aceita
    ↓
Fase
    ↓
Phase Preflight
    ↓
Implementation Contract
    ↓
Implementação
    ↓
Testes + verificação determinística
    ↓
Phase Self Check
    ↓
PASS com evidência
    ↓
Review interno (/code-review, /security-review)
    ↓
Review externo (Codex/Cursor)
```

### Antes da implementação

1. Leia a fase da ADR pedida e sua acceptance criteria.
2. Inspecione a implementação atual do repositório relevante pra essa fase.
3. Rode o Phase Preflight definido em `docs/development/phase-preflight.md`.
4. Leia os guardrails do repositório que o Preflight apontou como
   aplicáveis.
5. Estabeleça o Implementation Contract: invariantes que precisam continuar
   verdadeiras; comportamento que não pode ocorrer; caminhos afetados que
   precisam ficar consistentes; casos de borda a tratar; testes/evidência
   necessários pra provar a implementação.

Só depois dessa análise o código de implementação deve ser modificado.

Não pule o preflight porque a ADR já tem um plano detalhado, uma fase
anterior já foi analisada, a mudança parece pequena, ou um código parecido
já foi implementado antes — ver a seção "Não pule o Preflight porque..." em
`docs/development/phase-preflight.md` pro porquê cada uma dessas já falhou
neste repo.

A ADR descreve intenção. O repositório atual descreve realidade. Os
guardrails descrevem modo de falha já acumulado. A implementação precisa
reconciliar os três.

### Durante a implementação

Implemente a invariante, não só o cenário relatado.

Quando uma invariante afeta uma entidade ou transição de estado, inspecione
todos os caminhos relevantes, quando aplicável: leitura, insert, update,
delete, retry, replay/reprocessamento, fallback, execução concorrente,
migration/backfill.

Não implemente um fix local quando o requisito real é uma invariante de
repositório ou de domínio.

Adicione os testes identificados no preflight como parte da implementação,
não depois que o review pedir.

### Depois da implementação

1. Rode os testes relevantes.
2. Rode lint, typecheck e verificação de formatação.
3. Rode o Phase Self Check definido em `docs/development/phase-self-check.md`.
4. Compare a implementação final contra as MESMAS invariantes declaradas no
   preflight.
5. Dê evidência concreta de código/teste pra cada invariante.
6. Corrija todo FAIL.
7. Investigue todo UNPROVEN.

Não declare a fase completa enquanto qualquer invariante aplicável
continuar FAIL ou UNPROVEN.

### Review de IA

Review de IA acontece só depois de implementação, testes e Phase Self
Check completos.

Critério de quando rodar `/code-review` (`high`) e `/security-review` já
está em `docs/guardrails-processo.md` — aplicar, não duplicar.

Review interno precisa terminar antes de abrir a implementação pro review
externo (Codex/Cursor).

Não espere o Codex/Cursor reportar o primeiro achado pra só então rodar o
review interno obrigatório — o objetivo é evitar pagar múltiplas rodadas de
review por violação que já devia ter sido identificada antes.
