#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — bloqueia `git commit` se lint/typecheck/
# testes deno relevantes falharem. Ver docs/guardrails-processo.md.
#
# Roda contra o snapshot do ÍNDICE (o que o commit vai gravar), não contra
# o working tree — staging parcial (`git add -p`) com um fix só no disco
# não pode fazer o hook passar enquanto o blob staged ainda está quebrado.
# Se o comando for `git -C <dir> commit`, os checks rodam nesse dir.
#
# Usa binários de `node_modules/.bin` (nunca `npx tsc`, que sem
# node_modules baixa o pacote errado `tsc@2.0.4` em vez de typescript).
set -uo pipefail

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

# Só age em comandos que efetivamente rodam `git commit` (aceita `git -C dir`
# com dir citado ou não, encadeado com && / ; / |, sem espaço antes do
# separador). Não bloqueia nenhum outro comando Bash.
# Achado real de /code-review ultra local (PR #134): a versão anterior
# exigia espaço ou fim-de-string logo após "commit" (`commit( |$)`), então
# `git commit&&git push`/`git commit;git push` (sem espaço antes do
# separador) bypassavam o gate inteiro sem erro nem aviso. Fix: qualquer
# caractere NÃO-alfabético (ou fim de string) depois de "commit" conta como
# boundary — `commit($|[^a-zA-Z-])` — hífen fica de fora pra não
# disparar em `git commit-tree`/`git commit-graph`. -C aceita path
# entre aspas (simples ou duplas) além de sem aspas, pra não perder
# `git -C "dir com espaço" commit`.
if ! printf '%s' "$CMD" | grep -qE '(^|[;&|]) *git( -C ("[^"]*"|'"'"'[^'"'"']*'"'"'|[^ ]+))? commit($|[^a-zA-Z-])'; then
  exit 0
fi

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
}

ORIG_DIR=$(pwd)
REPO_DIR="$ORIG_DIR"
# Extrai o alvo de `git -C`, com ou sem aspas. **Âncora `(^|[;&|])`
# obrigatória** (achado real, self-inflicted — bloqueou um commit de
# verdade desta própria correção): sem âncora, a regex batia dentro do
# TEXTO da mensagem de commit — ex.: uma mensagem citando "só `git -C
# dir commit`" como exemplo virava, pro extrator, um -C de verdade
# apontando pro diretório literal "dir". Mesma âncora do detector
# primário (linha ~29), que já não sofre disso.
if [[ "$CMD" =~ (^|[\;\&\|])[[:space:]]*git[[:space:]]+-C[[:space:]]+(\"([^\"]+)\"|\'([^\']+)\'|([^[:space:]]+))[[:space:]]+commit ]]; then
  REPO_DIR="${BASH_REMATCH[3]:-${BASH_REMATCH[4]:-${BASH_REMATCH[5]}}}"
  if [ ! -d "$REPO_DIR" ]; then
    deny "Commit bloqueado — git -C $REPO_DIR não é um diretório."
    exit 0
  fi
  cd "$REPO_DIR" || exit 0
  REPO_DIR=$(pwd)
elif [[ "$CMD" =~ (^|[\;\&\|])[[:space:]]*cd[[:space:]]+(\"([^\"]+)\"|\'([^\']+)\'|([^[:space:]]+))[[:space:]]*(\&\&|\;)[[:space:]]*git[[:space:]]+commit ]]; then
  # `cd <dir> && git commit` (ou `;`) no MESMO comando — achado real de
  # /code-review ultra local, PR #134: só `-C` era reconhecido; um `cd`
  # explícito antes do `git commit` fazia todo check rodar no diretório
  # ERRADO (o `cd` do comando ainda não rodou de verdade quando o hook
  # PreToolUse é avaliado — roda ANTES da tool, não depois).
  REPO_DIR="${BASH_REMATCH[3]:-${BASH_REMATCH[4]:-${BASH_REMATCH[5]}}}"
  case "$REPO_DIR" in
    /*) : ;;
    *) REPO_DIR="$ORIG_DIR/$REPO_DIR" ;;
  esac
  if [ ! -d "$REPO_DIR" ]; then
    deny "Commit bloqueado — cd $REPO_DIR não é um diretório."
    exit 0
  fi
  cd "$REPO_DIR" || exit 0
  REPO_DIR=$(pwd)
fi

# `-a`/`--all`/`--include`/`--only`/pathspec explícito fazem o commit
# gravar MAIS (ou diferente) do que o índice atual — `git write-tree`
# abaixo só reflete o que já está staged AGORA, não o que essas opções
# vão adicionar durante o próprio `git commit`. Negar em vez de validar
# um snapshot que não é o que será gravado de verdade (achado real de
# /code-review ultra local, PR #134: `git commit -am "..."` com índice
# limpo pulava todo check e commitava working-tree TS não validado).
#
# **Busca só na CABEÇA do comando, antes de `-m`/`--message`/heredoc**
# (achado SELF-INFLICTED de verdade — bloqueou esta própria mensagem de
# commit, que cita "-a/--all/--include/--only" como exemplo de texto: um
# `grep` sem escopo bate no CONTEÚDO da mensagem também, não só nos
# flags reais do comando invocado). Trunca em python3 [multi-linha,
# `sed`/`grep` não cortam heredoc de várias linhas de forma confiável]
# no primeiro `-m`/`--message`/`<<` — em qualquer commit real, os flags
# de verdade vêm ANTES da mensagem, nunca depois.
CMD_HEAD=$(printf '%s' "$CMD" | python3 -c '
import re, sys
s = sys.stdin.read()
m = re.search(r"(--message\b|-m\b|<<)", s)
sys.stdout.write(s[: m.start()] if m else s)
')
if printf '%s' "$CMD_HEAD" | grep -qE '(^|[;&|])[[:space:]]*git[[:space:]]+(-C[[:space:]]+\S+[[:space:]]+)?commit\b.*[[:space:]](-[a-zA-Z]*a[a-zA-Z]*\b|--all\b|--include\b|--only\b)'; then
  deny "Commit bloqueado — 'git commit -a/--all/--include/--only' grava mais do que o índice atual, e este hook só valida o snapshot já staged. Rode 'git add' explícito nos arquivos e um 'git commit' simples (sem essas flags)."
  exit 0
fi

echo "[pre-commit-checks] git commit detectado — rodando lint/typecheck/testes (snapshot do índice) em $REPO_DIR" >&2

FAIL_MSGS=()
STAGED_TREE=""
cleanup() {
  [ -n "${STAGED_TREE:-}" ] && rm -rf "$STAGED_TREE"
  cd "$ORIG_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Snapshot do índice (= o que `git commit` gravaria agora). eslint/tsc/deno
# leem daqui, não do working tree. Se o índice estiver em conflito
# (rebase/merge), write-tree falha — negar, nunca aprovar um snapshot
# incompleto.
STAGED_TREE=$(mktemp -d)
if ! TREE_HASH=$(git write-tree 2>/dev/null); then
  deny "Commit bloqueado — git write-tree falhou (índice em conflito? resolva e tente de novo)."
  exit 0
fi
if ! git archive "$TREE_HASH" | tar -x -C "$STAGED_TREE"; then
  deny "Commit bloqueado — falha ao materializar o snapshot do índice."
  exit 0
fi
if [ -d "$REPO_DIR/node_modules" ]; then
  ln -s "$REPO_DIR/node_modules" "$STAGED_TREE/node_modules"
fi
BIN="$REPO_DIR/node_modules/.bin"

# eslint só nos arquivos staged, não `npm run lint` (eslint .) no repo
# inteiro — o baseline atual tem ~560 erros pré-existentes fora do que
# está sendo commitado; rodar full-repo bloquearia QUALQUER commit pra
# sempre. Lido em array (não string) pra sobreviver a path com espaço
# (achado real de /code-review ultra local, PR #134).
STAGED_TS=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  STAGED_TS+=("$f")
done < <(git diff --cached --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' 2>/dev/null | grep -v '^\.claude/worktrees/' || true)

if [ ${#STAGED_TS[@]} -gt 0 ]; then
  if [ ! -x "$BIN/eslint" ]; then
    FAIL_MSGS+=("eslint não encontrado em node_modules (rode npm install)")
  else
    echo "[pre-commit-checks] eslint nos arquivos staged (snapshot do índice)" >&2
    if ! (
      cd "$STAGED_TREE"
      FAIL=0
      for file in "${STAGED_TS[@]}"; do
        [ -f "$file" ] || continue
        if ! "$BIN/eslint" "$file"; then
          FAIL=1
        fi
      done
      exit "$FAIL"
    ); then
      FAIL_MSGS+=("eslint falhou nos arquivos staged")
    fi
  fi
fi

# tsc --noEmit é full-project (não dá pra escopar sem perder o grafo de
# tipos). Só roda se algum .ts/.tsx está staged (achado real: commit
# puro de docs/SQL/YAML pagava o custo sem benefício). **Gate usa ACDMR
# (inclui Delete), não o ACMR do eslint** (achado real de /code-review
# ultra local, PR #134: um commit que só DELETA um .ts/.tsx não aparece
# em STAGED_TS — filtrado por ACMR, que exclui D, correto pro eslint já
# que não dá pra lintar um arquivo que não existe mais — mas apagar um
# módulo ainda importado em outro lugar quebra o type-check do resto do
# projeto, e sem checar deleção o hook aprovaria esse commit sem rodar
# tsc nenhuma vez; testado com fixture real de `git rm` staged). Roda
# no snapshot do índice pra não deixar um fix unstaged mascarar erro
# staged. Nota: o tsconfig raiz tem `"files": []` + project references,
# então `tsc --noEmit` sem `-p`/`-b` é um check fraco (sempre passa);
# endurecer pra `tsc -p tsconfig.app.json` hoje falha em dezenas de
# erros pré-existentes — mesmo raciocínio do eslint full-repo. Ver
# docs/guardrails-processo.md.
TS_DELETED=$(git diff --cached --name-only --diff-filter=D -- '*.ts' '*.tsx' 2>/dev/null | grep -v '^\.claude/worktrees/' || true)
if [ ${#STAGED_TS[@]} -gt 0 ] || [ -n "$TS_DELETED" ]; then
  if [ ! -x "$BIN/tsc" ]; then
    FAIL_MSGS+=("typescript não encontrado em node_modules (rode npm install)")
  elif ! (cd "$STAGED_TREE" && "$BIN/tsc" --noEmit); then
    FAIL_MSGS+=("tsc --noEmit falhou")
  fi
fi

# Suite deno é pequena (2 arquivos). Qualquer .ts staged em
# supabase/functions/** dispara a suite inteira no snapshot do índice —
# cobre regressão no módulo de produção sem o .test.ts ir junto.
# **Também dispara se um .ts foi DELETADO** (achado real de
# /code-review ultra local, PR #134, mesmo padrão do TS_DELETED do
# tsc acima): apagar só `getnetExtratoParser.ts` enquanto
# `getnetExtratoParser.test.ts` continua staged/existente não aparece
# em ACMR — sem rodar a suite, ninguém percebe que o teste restante
# agora importa um módulo que não existe mais no snapshot (rodar
# deno test É a forma de pegar esse import quebrado).
STAGED_FN_TS=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  STAGED_FN_TS+=("$f")
done < <(git diff --cached --name-only --diff-filter=ACMR -- 'supabase/functions/*.ts' 'supabase/functions/**/*.ts' 2>/dev/null || true)
FN_TS_DELETED=$(git diff --cached --name-only --diff-filter=D -- 'supabase/functions/*.ts' 'supabase/functions/**/*.ts' 2>/dev/null || true)

if [ ${#STAGED_FN_TS[@]} -gt 0 ] || [ -n "$FN_TS_DELETED" ]; then
  if ! command -v deno >/dev/null 2>&1; then
    FAIL_MSGS+=("deno não encontrado no PATH (necessário pra testar supabase/functions)")
  else
    echo "[pre-commit-checks] deno test supabase/functions (snapshot do índice)" >&2
    if ! (cd "$STAGED_TREE" && deno test supabase/functions); then
      FAIL_MSGS+=("deno test falhou em supabase/functions")
    fi
  fi
fi

if [ ${#FAIL_MSGS[@]} -gt 0 ]; then
  REASON=$(IFS='; '; echo "${FAIL_MSGS[*]}")
  deny "Commit bloqueado — $REASON. Corrija e tente de novo (ou rode os comandos manualmente pra ver o erro completo)."
  exit 0
fi

echo "[pre-commit-checks] lint/typecheck/testes OK — liberando commit." >&2
exit 0
