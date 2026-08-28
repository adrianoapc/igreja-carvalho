#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — bloqueia `git commit` se lint/typecheck/
# testes deno relevantes falharem. Ver docs/guardrails-processo.md.
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
# boundary — `commit($|[^a-zA-Z])` — e -C aceita path entre aspas (simples
# ou duplas) além de sem aspas, pra não perder `git -C "dir com espaço"
# commit`.
if ! printf '%s' "$CMD" | grep -qE '(^|[;&|]) *git( -C ("[^"]*"|'"'"'[^'"'"']*'"'"'|[^ ]+))? commit($|[^a-zA-Z])'; then
  exit 0
fi

echo "[pre-commit-checks] git commit detectado — rodando lint/typecheck/testes antes de permitir." >&2

FAIL_MSGS=()

# eslint só nos arquivos staged, não `npm run lint` (eslint .) no repo
# inteiro — o baseline atual tem ~560 erros pré-existentes fora do que
# está sendo commitado; rodar full-repo bloquearia QUALQUER commit pra
# sempre. Isso cobre o que a mudança está introduzindo, sem exigir
# limpar débito legado como efeito colateral de um commit não relacionado.
# Lido em array (não string), pra sobreviver a path com espaço sem
# word-splitting/glob expansion na hora de repassar pro eslint (achado
# real de /code-review ultra local, PR #134 — `npx eslint $STAGED_TS`
# sem aspas quebra em 2+ argumentos bogus se algum path staged tiver
# espaço; o repo já tem paths assim sob docs/, então não é hipotético).
STAGED_TS=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  STAGED_TS+=("$f")
done < <(git diff --cached --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' 2>/dev/null | grep -v '^\.claude/worktrees/' || true)

if [ ${#STAGED_TS[@]} -gt 0 ]; then
  if ! npx eslint "${STAGED_TS[@]}"; then
    FAIL_MSGS+=("eslint falhou nos arquivos staged")
  fi
fi

# tsc --noEmit é full-project (não dá pra escopar sem perder o grafo de
# tipos), mas o baseline está limpo hoje — manter assim. **Só roda se
# algum .ts/.tsx está staged** (achado real de /code-review ultra local,
# PR #134: rodando incondicional, todo commit puro de docs/SQL/YAML —
# comum neste repo, ver CLAUDE.md §Processo de PR — paga o custo total
# de compilar o projeto inteiro sem NENHUM arquivo TS mudado, zero
# benefício possível). Reusa o mesmo STAGED_TS do eslint acima.
if [ ${#STAGED_TS[@]} -gt 0 ]; then
  if ! npx tsc --noEmit; then
    FAIL_MSGS+=("npx tsc --noEmit falhou")
  fi
fi

# Roda o teste existente também quando o MÓDULO de produção muda, não só
# quando o próprio arquivo .test.ts está staged (achado real de @codex
# review: mudar só getnetExtratoParser.ts sem tocar
# getnetExtratoParser.test.ts deixava STAGED_TESTS vazio e nenhum teste
# rodava, mesmo com cobertura existente pra esse módulo exato).
STAGED_FN_TS=$(git diff --cached --name-only --diff-filter=ACMR -- 'supabase/functions/*.ts' 'supabase/functions/**/*.ts' 2>/dev/null || true)
# Array, não string — mesma razão do STAGED_TS acima (achado real de
# /code-review ultra local, PR #134): repassar via string sem aspas pro
# `deno test` quebra em word-splitting/glob se algum path tiver espaço.
# Dedup via sort -u num round-trip por linha (não `declare -A`) — o
# `/bin/bash` padrão do macOS é 3.2, sem array associativo (só chegou no
# bash 4.0); achado real de /code-review ultra local, PR #134, testando
# o hook de verdade neste ambiente, não só validando sintaxe.
RAW_TESTS=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    *.test.ts)
      candidate="$file"
      ;;
    *.ts)
      candidate="${file%.ts}.test.ts"
      [ -f "$candidate" ] || continue
      ;;
    *)
      continue
      ;;
  esac
  RAW_TESTS="$RAW_TESTS$candidate
"
done <<< "$STAGED_FN_TS"

TESTS_TO_RUN=()
while IFS= read -r candidate; do
  [ -z "$candidate" ] && continue
  TESTS_TO_RUN+=("$candidate")
done < <(printf '%s' "$RAW_TESTS" | sort -u)

if [ ${#TESTS_TO_RUN[@]} -gt 0 ]; then
  echo "[pre-commit-checks] Testes deno a rodar: ${TESTS_TO_RUN[*]}" >&2
  if ! deno test "${TESTS_TO_RUN[@]}"; then
    FAIL_MSGS+=("deno test falhou em: ${TESTS_TO_RUN[*]}")
  fi
fi

if [ ${#FAIL_MSGS[@]} -gt 0 ]; then
  REASON=$(IFS='; '; echo "${FAIL_MSGS[*]}")
  jq -n --arg reason "Commit bloqueado — $REASON. Corrija e tente de novo (ou rode os comandos manualmente pra ver o erro completo)." '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi

echo "[pre-commit-checks] lint/typecheck/testes OK — liberando commit." >&2
exit 0
