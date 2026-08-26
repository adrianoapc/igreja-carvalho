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
| `has_filial_access()`/RLS sem `FOR`/`TO`, 3 "fixes finais" separados em 12 dias | #97, #98, #118, #124-132 (15+) | `migration-harness.yml` |
| `.eq("filial_id")` escondendo recurso compartilhado, mesmo bug 3x | #82, #92, #95, #97, #103 | `pattern-guardrails.yml` |
| Delete/update com sucesso falso quando RLS nega (`error:null`) | #126 | `pattern-guardrails.yml` |
| `STATUS_COLOR` usado como `color:` (falha WCAG) | #114 | `pattern-guardrails.yml` + `chartPalette.ts` |
| Migration/deploy falha silenciosa (timestamp, `ALTER POLICY` em coluna inexistente) | #85, #116, #119, #128 | `migration-harness.yml` |
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
- **`pattern-guardrails.yml`** (novo): grep puro nos arquivos mudados de
  cada PR, bloqueando os 3 padrões da tabela acima que são detectáveis
  por regex — `.eq("filial_id"` sem `.or(...is.null)`, `.delete()`/
  `.update()` sem `{count:"exact"}`, `STATUS_COLOR` usado como `color:`.
  Escapes explícitos via comentário (`// filial-global-ok`,
  `// count-exact-ok`) pra falso positivo legítimo. Também avisa
  (não bloqueia) sobre hex hardcoded em componente de dashboard/chart.
- **`migration-harness.yml`** (novo): em toda PR que toca
  `supabase/migrations/**`, sobe um Supabase local (Docker,
  `supabase start` + `supabase db reset`) e aplica TODAS as migrations do
  zero — hoje isso só acontecia em `supabase-deploy.yml`, DEPOIS do
  merge, direto contra o projeto real. Também audita (aviso, não bloqueio
  — muitas policies `{public}` são legítimas) policies com
  `roles={public}`, sinal de `CREATE POLICY` sem `TO` explícito.

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
  `git commit` e roda, ANTES de permitir o commit: eslint nos arquivos
  `.ts`/`.tsx` staged (não `npm run lint` no repo inteiro — o baseline
  tinha ~560 erros pré-existentes fora do que estava sendo commitado;
  rodar full-repo bloquearia qualquer commit pra sempre), `tsc --noEmit`
  completo (baseline limpo hoje), e `deno test` nos `*.test.ts` staged
  dentro de `supabase/functions/**`. Bloqueia o commit
  (`permissionDecision: deny`) se qualquer um falhar.
- **`pr-review-reminder.sh`** (`PreToolUse`, matcher `Bash`): lembrete
  não-bloqueante antes de `gh pr create` — não dá pra verificar de forma
  confiável que `/code-review`/`/security-review` rodaram, então isso é
  aviso (`systemMessage`), não gate artificial.

**Limite importante**: hooks do Claude Code só disparam dentro de uma
sessão Claude Code com este `.claude/settings.json` carregado — não
protegem contra um `git commit`/`gh pr create` direto no terminal, nem
contra outra ferramenta. Por isso o gate real e definitivo continua sendo
o CI (`pattern-guardrails.yml`, `migration-harness.yml`) + branch
protection, não os hooks. Os hooks são a primeira linha (feedback mais
rápido, antes até de existir commit), o CI é a linha que não depende de
qual ferramenta foi usada pra escrever o código.

### PR template — `.github/pull_request_template.md`

Seção "Review (obrigatório)" nova: confirmação de `/code-review` rodado,
`/security-review` quando aplicável, harness local de migration quando
aplicável, `chartPalette.ts`/skill `dataviz` quando aplicável, e
confirmação explícita de que o bot de review realmente rodou (não só
"usage limit reached").

### Branch protection (main)

Ver commit/PR que ativou — checklist do que foi configurado:
- PR obrigatória antes de merge em `main` (sem push direto)
- Status checks obrigatórios: `docs_guard`, `pattern_guardrails`,
  `migration_harness` (quando aplicável)
- Sem force-push, sem deleção da branch

Deliberadamente **não** exige aprovação humana (≥1 reviewer) — projeto é
mantido por 1 dev; exigir isso bloquearia todo merge. O gate real é
status check verde, não aprovação de terceiro.

## Fora de escopo (não fechado nesta rodada)

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

**Última Atualização**: 2026-08-26
