# Guardrails de processo (review, CI, dataviz)

Nasceu de uma auditoria em 2026-08-26: 98 PRs mergeadas desde maio/2026,
64 revisadas a fundo (reviews + comentários via `gh`). Dois achados
dominaram tudo e motivaram este documento — ver detalhe completo abaixo.

## O que a auditoria achou

**1. O gate de review automático falha silenciosamente na maior parte do
tempo.** Em 34 das 64 PRs amostradas (53%), o Cursor Bugbot só retornou
"usage limit reached" — nenhuma revisão real aconteceu, e nada alertava
pra isso. As PRs #57–#64 (corrigindo um bug real de sinal na taxa
administrativa financeira) não tiveram **nenhuma** revisão substantiva —
nem humana, nem de bot.

**2. Nada bloqueava merge.** `main` não tinha branch protection
(`gh api repos/.../branches/main/protection` retornava 404) nem
CODEOWNERS. Quando o processo manual documentado ("`/code-review` local
antes do 1º `@codex review`") era seguido de verdade, funcionava bem —
multi-rodada, contra harness de Postgres real. O problema é que era
opcional e às vezes silenciosamente pulado.

**3. Padrões recorrentes** — cada um já causou incidente real, não é
hipotético:

| Padrão | PRs onde apareceu | Guardrail que fecha |
|---|---|---|
| `has_filial_access()`/RLS sem `FOR`/`TO`, 3 "fixes finais" separados em 12 dias | #97, #98, #118, #124-132 (15+) | Não fechado ainda — harness bloqueado, ver §Fora de escopo |
| `.eq("filial_id")` escondendo recurso compartilhado, mesmo bug 3x | #82, #92, #95, #97, #103 | `pattern-guardrails.yml` |
| Delete/update com sucesso falso quando RLS nega (`error:null`) | #126 | `pattern-guardrails.yml` |
| `STATUS_COLOR` usado como `color:` (falha WCAG) | #114 | `pattern-guardrails.yml` + `chartPalette.ts` |
| Migration/deploy falha silenciosa (timestamp, `ALTER POLICY` em coluna inexistente) | #85, #116, #119, #128 | Não fechado ainda — harness bloqueado, ver §Fora de escopo |
| Integração inteira quebrada só achada em produção (PIX, cron) | #101, #106-109 | Não automatizado ainda — ver §Fora de escopo |
| `docs-guard.yml` FIX MODE nunca ativa (`PR_LABELS` via `.*.name` vira `"Array"`) | achado em memória de sessão, confirmado 2026-08-26 | Corrigido direto no workflow |

**4. Dataviz**: disciplina real só existia pra pills de status
(`statusPalette.ts`, nascida do achado da PR #114) — fora isso, 8+
paletas hex divergentes espalhadas por dashboard, zero dark-mode em cor
de série de gráfico.

## Guardrails implementados (2026-08-26)

### CI — `.github/workflows/`

- **`docs-guard.yml`**: fix do bug de detecção de label `doc:fix`
  (`PR_LABELS` via `.*.name` serializava como a string `"Array"`; agora
  resolvido via `contains()` do próprio GitHub Actions, passado por env
  var já avaliada).
- **`pattern-guardrails.yml`** (novo): grep numa **janela em torno de
  cada hunk do diff** da PR, não o arquivo inteiro (a 1ª versão escaneava
  o arquivo completo — achado real de `@codex review`: já existem 88
  arquivos com `.eq("filial_id"...)` sem anotação, escanear tudo
  bloquearia qualquer edição futura neles). A janela cobre linhas
  adicionadas **e** margem em torno de hunks só-de-remoção — 2ª rodada de
  review achou que remover só a linha `{ count: "exact" }` de um
  `.delete()` multi-linha é uma regressão real que não aparece como linha
  "adicionada" nenhuma. Detectores em
  `.github/scripts/pattern-guardrails.sh` (o workflow roda `--self-test`
  antes de escanear a PR). Bloqueia os 3 padrões da tabela acima:
  - `.eq("filial_id"` **é o bug em si**. Um `.or("filial_id.is.null")` no
    mesmo chain **não** basta — PostgREST ANDa os filtros, então
    `.eq("filial_id", id).or("filial_id.eq.id,filial_id.is.null")` continua
    excluindo as linhas globais. A forma correta **substitui** o `.eq` por
    `.or("filial_id.eq.X,filial_id.is.null")`. Escape: `// filial-global-ok`
    (exclusão de globais intencional).
  - `.delete()`/`.update()` do Supabase sem `{count:"exact"}` **nos
    argumentos desta call** (não numa irmã a N linhas — `count: "exact"`
    de um `.select` ou de outro `.delete` no mesmo bloco não protege).
    Cobre chain multi-linha (`.from("x")` numa linha e `.delete(...)` na
    próxima). Distingue `Array.from` / `Set.delete` — um statement
    anterior terminado em `;` (mesmo com `supabase.from(`) **não** é o
    chain desta call; comentário com `.from("` também não religa o chain.
    Escape: `// count-exact-ok`.
  - `STATUS_COLOR` usado como `color:`.
  Matches só disparam se o início está em **código** (não string nem
  comentário) — `const note = '.eq("filial_id", id)'` não trava a PR.
  Também avisa (não bloqueia) sobre 3+ literais hex em qualquer `.ts`/
  `.tsx` tocado (a 1ª heurística exigia `COLORS` na mesma linha E path
  com dashboard/chart — nenhum dos 5 arquivos-alvo batia nos dois).
  **Limite conhecido, não fechado**: o check de `{count:"exact"}` confirma
  que a opção está nesta call, não que o código realmente lê e rejeita
  `count===0` — um call site que passa a opção mas ignora o valor
  retornado passa no guardrail com o bug original ainda vivo (não dá pra
  fechar isso com confiança via regex, precisaria de parser real).

**`migration-harness.yml` foi retirado desta rodada.** A ideia (subir
Supabase local via Docker e aplicar todas as migrations do zero antes do
merge) segue válida, mas a própria `@codex review` da PR #134 achou que
a história de migrations do repo já está com drift documentado (`AGENTS.md`
§"Local Supabase is NOT reproducible from committed migrations": `public.
itens_reembolso` nunca foi criada por nenhuma migration — só existe em
produção — e `public.times_culto` é referenciada por uma migration
posterior à que a removeu). Isso faz `supabase db reset` falhar sempre,
em ~166 das 421 migrations, independente do que a PR mude — um workflow
assim ficaria vermelho pra sempre e treinaria a ignorar CI vermelho,
o oposto do objetivo. Corrigir isso exige puxar o schema real de produção
com cuidado antes de escrever qualquer migration de cauda — **nunca**
resetar/dropar/truncar tabela de produção; se precisar recriar algo,
o caminho é renomear a atual, criar a nova e reinserir os dados. Fica pra
sessão dedicada — ver §Fora de escopo.

Nenhum desses substitui `/code-review` ou `/security-review` — são grep e
harness determinístico, sem julgamento. Continuam pegando só o que já se
repetiu; um padrão novo de bug não é detectado até alguém adicionar a
regra.

### Dataviz — `src/lib/chartPalette.ts`

Paleta categórica compartilhada pra série de gráfico (`CHART_SERIES_COLORS`,
`chartColor(index)`), reaproveitando os tokens `--chart-1..5` já
definidos em `src/index.css` (claro e escuro). Antes de criar gráfico
novo: usar este arquivo pra cor categórica, `statusPalette.ts` pra cor de
STATUS (pill/badge), e consultar a skill `dataviz` pra paleta
sequencial/divergente ou heurística de forma de gráfico.

### Hooks do Claude Code — `.claude/settings.json` + `.claude/hooks/`

- **`pre-commit-checks.sh`** (`PreToolUse`, matcher `Bash`): intercepta
  `git commit` (inclusive `git -C <dir> commit`, `git -c key=val commit`,
  prefixo `VAR=val`) e roda, ANTES de permitir o commit, contra o
  **snapshot do índice** (`git write-tree` + archive — o que o commit vai
  gravar, não o working tree): eslint nos
  arquivos `.ts`/`.tsx` staged (não `npm run lint` no repo inteiro — o
  baseline tinha ~560 erros pré-existentes fora do que estava sendo
  commitado; rodar full-repo bloquearia qualquer commit pra sempre),
  `tsc --noEmit` completo (baseline limpo hoje), e a suite `deno test
  supabase/functions` inteira sempre que qualquer `.ts` em
  `supabase/functions/**` estiver staged (a suite é pequena — 2 arquivos
  — e assim uma mudança só no módulo de produção ainda dispara o teste
  existente). Bloqueia o commit (`permissionDecision: deny`) se qualquer
  um falhar. Recusa `-a`/`--all`/`--include`/`--only`/`--patch`/`-p`/
  `--interactive` e pathspec depois de `--` — essas flags gravariam
  mais do que o snapshot do índice que o hook valida. `--self-test`
  (rodado no job `pattern_guardrails`) recusa a classe POSIX
  descendente que já derrubou o gate no BSD grep do macOS, e o gate
  trata grep exit ≥2 como deny (fail-closed) em vez de "não é commit".
- **`pr-review-reminder.sh`** (`PreToolUse`, matcher `Bash`): lembrete
  não-bloqueante antes de `gh pr create` — não dá pra verificar de forma
  confiável que `/code-review`/`/security-review` rodaram, então isso é
  aviso (`systemMessage`), não gate artificial.

**Limites conhecidos, não fechados** (achados de `@codex review` na
própria PR #134):
- Hooks do Claude Code só disparam dentro de uma sessão Claude Code com
  este `.claude/settings.json` carregado — não protegem contra um
  `git commit`/`gh pr create` direto no terminal, nem contra outra
  ferramenta. Por isso o gate real e definitivo continua sendo o CI
  (`pattern-guardrails.yml`) + branch protection, não os hooks. Os hooks
  são a primeira linha (feedback mais rápido, antes até de existir
  commit), o CI é a linha que não depende de qual ferramenta foi usada.
- `tsc --noEmit` no `tsconfig.json` raiz (`"files": []` + project
  references) **não typechecka `src/`** — sempre passa. `tsc -p
  tsconfig.app.json --noEmit` hoje falha em dezenas de erros
  pré-existentes; endurecer o hook exigiria limpar esse débito (mesmo
  raciocínio do eslint full-repo). O eslint nos arquivos staged continua
  sendo o check de código que de fato pega regressão nova.
- `git commit <arquivo>` sem `--` (pathspec implícito, implica
  `--only`) ainda não é recusado com confiança — a mensagem `-m` e
  `-F`/`--file` também consomem argumentos; o deny cobre pathspec só
  depois de `--` explícito, mais `-a`/`-p`/`--all`/`--patch`/
  `--include`/`--only`/`--interactive`.

### PR template — `.github/pull_request_template.md`

Seção "Review (obrigatório)" nova: confirmação de `/code-review` rodado,
`/security-review` quando aplicável, harness local de migration quando
aplicável, `chartPalette.ts`/skill `dataviz` quando aplicável, e
confirmação explícita de que o bot de review realmente rodou (não só
"usage limit reached").

### Branch protection (main)

Ativada em 2026-08-26 via `gh api .../branches/main/protection`. Configurado:
- PR obrigatória antes de merge em `main` (sem push direto), inclusive
  pra admin/dono do repo (`enforce_admins: true`) — a falha achada na
  auditoria era exatamente "nada bloqueia ninguém, nem quem está
  mergeando", então isolar o dono da regra reproduziria o mesmo buraco.
- Status checks obrigatórios: **`docs_guard`, `pattern_guardrails`**. Não
  há `migration_harness` — foi retirado desta rodada (ver acima).
- Conversas de review precisam estar resolvidas antes de merge
  (`required_conversation_resolution`).
- Sem force-push, sem deleção da branch.
- `strict: true` nos status checks — a branch precisa estar atualizada
  com `main` antes de mergear (evita merge de um estado já obsoleto).

Deliberadamente **não** exige aprovação humana (≥1 reviewer) — projeto é
mantido por 1 dev; exigir isso bloquearia todo merge. O gate real é
status check verde, não aprovação de terceiro.

**Quando `migration-harness.yml` voltar** (depois da sessão dedicada que
corrigir o drift de migrations): reintroduzir sem `paths:` filter no
trigger, com o filtro movido pra dentro do job (um `if:` que reporta
sucesso imediato quando nenhuma migration mudou) — só assim o check
sempre reporta status e pode entrar em `required_status_checks` com
segurança.

## Fora de escopo (não fechado nesta rodada)

- **Drift de migrations impedindo `supabase db reset` do zero** (bloqueia
  `migration-harness.yml`) — `public.itens_reembolso` nunca foi criada
  por nenhuma migration (só existe em produção) e `public.times_culto` é
  referenciada por uma migration posterior à que a removeu, ver `AGENTS.md`
  §"Local Supabase is NOT reproducible from committed migrations".
  Corrigir exige puxar o schema real de produção com cuidado antes de
  escrever a migration de cauda (provavelmente `CREATE TABLE IF NOT
  EXISTS itens_reembolso ...` + tornar o `ALTER TABLE ... times_culto`
  condicional). **Regra explícita do usuário pra essa correção: nunca
  resetar, dropar ou truncar tabela de produção — se precisar recriar
  algo, o caminho é renomear a tabela atual, criar a nova e reinserir os
  dados.** Fica pra sessão dedicada, com leitura read-only do schema real
  antes de qualquer escrita.
- **Smoke-test sintético agendado** pra integrações externas (PIX, cron,
  WhatsApp) — os incidentes #101/#106-109 ("nunca funcionou", só
  descoberto em produção) não são pegos por nenhum guardrail acima, que
  são todos estáticos (grep, harness de schema). Precisaria de um
  workflow agendado chamando de verdade `pix-webhook`, checando
  timestamp do último cron, etc. Fica pra sessão dedicada.
- **`p_flag_bot` scope confusion** (checklist já existe em CLAUDE.md) —
  não virou grep-CI porque o padrão não é regex-detectável com confiança
  sem falso positivo alto.
- **Duplicação de lógica cliente/servidor** — item de checklist no PR
  template, não automatizado (grep genérico teria ruído demais).

## Referências

- `docs/adr/ADR-033-remocao-make-com-pipeline-whatsapp.md` — PR que
  motivou a pergunta original sobre guardrails
- `docs/guardrails-financeiro.md` — mesmo padrão de doc, escopo financeiro
- Auditoria completa (98 PRs, ~64 revisadas): não versionada como
  documento separado, resumo consolidado acima

---

**Última Atualização**: 2026-08-28
