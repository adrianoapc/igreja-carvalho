#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — bloqueia `git commit` se lint/typecheck/
# testes deno relevantes falharem. Ver docs/guardrails-processo.md.
set -uo pipefail

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

# Só age em comandos que efetivamente rodam `git commit` (aceita `git -C dir
# commit`, encadeado com && / ; / |). Não bloqueia nenhum outro comando Bash.
if ! printf '%s' "$CMD" | grep -qE '(^|[;&|]) *git( -C [^ ]+)? commit( |$)'; then
  exit 0
fi

echo "[pre-commit-checks] git commit detectado — rodando lint/typecheck/testes antes de permitir." >&2

FAIL_MSGS=()

# eslint só nos arquivos staged, não `npm run lint` (eslint .) no repo
# inteiro — o baseline atual tem ~560 erros pré-existentes fora do que
# está sendo commitado; rodar full-repo bloquearia QUALQUER commit pra
# sempre. Isso cobre o que a mudança está introduzindo, sem exigir
# limpar débito legado como efeito colateral de um commit não relacionado.
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' 2>/dev/null | grep -v '^\.claude/worktrees/' || true)
if [ -n "$STAGED_TS" ]; then
  if ! npx eslint $STAGED_TS; then
    FAIL_MSGS+=("eslint falhou nos arquivos staged")
  fi
fi

# tsc --noEmit é full-project (não dá pra escopar sem perder o grafo de
# tipos), mas o baseline está limpo hoje — manter assim.
if ! npx tsc --noEmit; then
  FAIL_MSGS+=("npx tsc --noEmit falhou")
fi

# Roda o teste existente também quando o MÓDULO de produção muda, não só
# quando o próprio arquivo .test.ts está staged (achado real de @codex
# review: mudar só getnetExtratoParser.ts sem tocar
# getnetExtratoParser.test.ts deixava STAGED_TESTS vazio e nenhum teste
# rodava, mesmo com cobertura existente pra esse módulo exato).
STAGED_FN_TS=$(git diff --cached --name-only --diff-filter=ACMR -- 'supabase/functions/*.ts' 'supabase/functions/**/*.ts' 2>/dev/null || true)
TESTS_TO_RUN=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    *.test.ts)
      TESTS_TO_RUN="$TESTS_TO_RUN
$file"
      ;;
    *.ts)
      candidate="${file%.ts}.test.ts"
      [ -f "$candidate" ] && TESTS_TO_RUN="$TESTS_TO_RUN
$candidate"
      ;;
  esac
done <<< "$STAGED_FN_TS"
TESTS_TO_RUN=$(printf '%s\n' "$TESTS_TO_RUN" | grep -v '^$' | sort -u)

if [ -n "$TESTS_TO_RUN" ]; then
  echo "[pre-commit-checks] Testes deno a rodar: $TESTS_TO_RUN" >&2
  if ! deno test $TESTS_TO_RUN; then
    FAIL_MSGS+=("deno test falhou em: $TESTS_TO_RUN")
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
