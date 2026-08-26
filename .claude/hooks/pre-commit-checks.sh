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

STAGED_TESTS=$(git diff --cached --name-only --diff-filter=ACMR -- '*.test.ts' 2>/dev/null | grep '^supabase/functions/' || true)
if [ -n "$STAGED_TESTS" ]; then
  echo "[pre-commit-checks] Testes deno staged: $STAGED_TESTS" >&2
  if ! deno test $STAGED_TESTS; then
    FAIL_MSGS+=("deno test falhou em: $STAGED_TESTS")
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
