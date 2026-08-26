#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) — lembrete não-bloqueante antes de `gh pr
# create`. Não dá pra verificar de forma confiável que /code-review e
# /security-review rodaram, então isso é aviso, não gate. Ver
# docs/guardrails-processo.md — achado real: 53% das PRs revisadas numa
# auditoria (2026-08-26) só receberam "usage limit reached" do bot de
# review, sem revisão real nenhuma.
set -uo pipefail

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

if ! printf '%s' "$CMD" | grep -qE '(^|[;&|]) *gh pr create( |$)'; then
  exit 0
fi

jq -n '{
  systemMessage: "Lembrete: rodou /code-review e /security-review nesta branch antes de abrir a PR? Não é bloqueio automático — não dá pra verificar que a skill realmente rodou —, mas é o gate que mais faltou historicamente (53% das PRs numa auditoria só receberam \"usage limit reached\" do bot, sem revisão real). Ver docs/guardrails-processo.md."
}'
exit 0
