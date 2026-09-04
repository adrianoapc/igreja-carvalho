#!/usr/bin/env bash
# Statusline pessoal — mostra worktree/branch/ahead-behind/sujeira o tempo
# todo, pra responder de relance "estou editando o worktree/branch certo?"
# (ver CLAUDE.md §Onde a mudança pousa: worktree e branch).
#
# NÃO é ligada pelo settings.json do projeto — statusline é preferência
# pessoal e vale pra qualquer repo, não só este. Pra usar:
#   cp .claude/statusline.sh ~/.claude/statusline.sh
# e em ~/.claude/settings.json:
#   "statusLine": {"type": "command", "command": "bash ~/.claude/statusline.sh"}
set -uo pipefail

INPUT=$(cat 2>/dev/null || true)
DIR=""
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  DIR=$(printf '%s' "$INPUT" | jq -r '.workspace.current_dir // .cwd // empty' 2>/dev/null || true)
fi
[ -z "$DIR" ] && DIR=$(pwd)
[ -d "$DIR" ] || DIR=$(pwd)

if ! git -C "$DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '%s\n' "$DIR (fora de repo git)"
  exit 0
fi

ROOT=$(git -C "$DIR" rev-parse --show-toplevel 2>/dev/null)
COMMON=$(git -C "$DIR" rev-parse --git-common-dir 2>/dev/null)
BRANCH=$(git -C "$DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)
[ -z "$BRANCH" ] && BRANCH="(detached)"

# Primário = worktree cujo .git é um diretório de verdade (não um
# gitdir-file apontando pro common dir, como todo `git worktree add` gera).
LABEL="worktree"
if [ -d "$ROOT/.git" ]; then
  LABEL="primário"
fi
WT_NAME=$(basename -- "$ROOT")

DIRTY=$(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')

AHEAD_BEHIND=""
UPSTREAM=$(git -C "$ROOT" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)
if [ -n "$UPSTREAM" ]; then
  COUNTS=$(git -C "$ROOT" rev-list --left-right --count "${UPSTREAM}...HEAD" 2>/dev/null || true)
  if [ -n "$COUNTS" ]; then
    BEHIND=$(printf '%s' "$COUNTS" | awk '{print $1}')
    AHEAD=$(printf '%s' "$COUNTS" | awk '{print $2}')
    AHEAD_BEHIND=" ↑$AHEAD ↓$BEHIND"
  fi
fi

DIRTY_LABEL=""
[ "$DIRTY" != "0" ] && [ -n "$DIRTY" ] && DIRTY_LABEL=" ●$DIRTY"

if [ "$LABEL" = "primário" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
  printf '⚠ (primário) %s [%s]%s%s — primário deveria estar em main\n' "$WT_NAME" "$BRANCH" "$AHEAD_BEHIND" "$DIRTY_LABEL"
else
  printf '(%s) %s [%s]%s%s\n' "$LABEL" "$WT_NAME" "$BRANCH" "$AHEAD_BEHIND" "$DIRTY_LABEL"
fi
