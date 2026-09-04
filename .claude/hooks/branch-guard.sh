#!/usr/bin/env bash
# PreToolUse hook (matcher: "Write|Edit" e "Bash") — protege a invariante
# "checkout primário sempre em main/limpo; trabalho de feature sempre num
# worktree próprio" (ver CLAUDE.md §Onde a mudança pousa: worktree e branch).
#
# Duas garantias, cada uma independente:
#   1) Write/Edit nunca grava num worktree que está em `main`/`master` — a
#      única forma de editar é criar um worktree de feature primeiro.
#   2) Nenhuma escrita (Write/Edit, ou Bash que muta git/arquivos) pousa num
#      worktree cuja branch mudou desde a ÚLTIMA vez que este hook o viu —
#      pega o caso de uma sessão (ou pessoa, fora do Claude Code) trocar a
#      branch de um worktree que outra sessão já está usando.
#
# Estado (branch por worktree) fica em arquivos soltos sob
# .claude/hooks/.branch-guard-state/ (gitignored, global — não por sessão:
# não há como amarrar 2 execuções deste hook à mesma sessão com confiança
# suficiente, e o custo de errar pro lado de "registra de novo" é baixo).
#
# Filosofia (mesma do resto dos hooks deste repo, ver pre-commit-checks.sh):
# falha do PRÓPRIO hook (jq ausente, JSON malformado, diretório sumiu) nunca
# bloqueia — default é permitir. Só nega quando detecta com confiança um dos
# dois casos acima. Ver "Limitações conhecidas" no fim do arquivo.
set -uo pipefail

HOOK_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Respeita STATE_DIR herdado do ambiente (usado pelo --self-test pra nunca
# tocar no estado real de uma sessão em andamento — achado real de
# /code-review: sem o `:-`, o self-test rodava `rm -rf` no diretório de
# estado REAL, apagando o histórico de branch de todo worktree que a sessão
# já tinha visitado).
STATE_DIR="${STATE_DIR:-$HOOK_DIR/.branch-guard-state}"
STRIP_PY="$HOOK_DIR/strip-bash-command.py"

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

state_key_for() {
  # nome de arquivo determinístico a partir do path absoluto do worktree.
  # shasum é padrão no macOS/Linux; sem ele, cai pra um nome saneado (menos
  # robusto a colisão, mas não quebra o hook).
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1
  else
    printf '%s' "$1" | tr -c 'A-Za-z0-9' '_'
  fi
}

# $1 = qualquer diretório dentro (ou raiz) de um worktree candidato — NÃO
# precisa existir ainda (ex.: Write scaffolding uma pasta nova): sobe pra o
# ancestral existente mais próximo antes de checar. Achado real de
# /code-review: sem esse walk-up, `[ -d "$dir" ] || return 0` deixava
# QUALQUER escrita num diretório novo (o caso mais comum de "criar módulo
# novo") passar direto sem checar main/master nem mismatch de branch.
# Resolve a raiz real do worktree, compara/atualiza o estado, nega se achar
# main/master ou mismatch. Silencioso (sem side-effect) se $1 não é git.
check_worktree() {
  local dir="$1"
  while [ -n "$dir" ] && [ "$dir" != "/" ] && [ ! -d "$dir" ]; do
    dir=$(dirname -- "$dir")
  done
  [ -d "$dir" ] || return 0
  git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  local root
  root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || return 0
  local branch
  branch=$(git -C "$root" rev-parse --abbrev-ref HEAD 2>/dev/null)
  [ -z "$branch" ] && return 0
  [ "$branch" = "HEAD" ] && return 0 # detached — fora de escopo deste guard

  if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
    deny "Escrita recusada — '$root' está em '$branch'. Checkout em main/master não recebe edição direta: crie um worktree pra essa mudança (git worktree add .claude/worktrees/<nome> -b <branch> origin/main) e trabalhe nele. Ver CLAUDE.md §Onde a mudança pousa."
  fi

  mkdir -p "$STATE_DIR" 2>/dev/null || return 0
  local sf="$STATE_DIR/$(state_key_for "$root")"
  if [ -f "$sf" ]; then
    local recorded
    recorded=$(cat "$sf" 2>/dev/null || true)
    if [ -n "$recorded" ] && [ "$recorded" != "$branch" ]; then
      deny "Escrita recusada — '$root' estava em '$recorded' da última vez que este hook viu esse worktree, e agora está em '$branch'. Algo trocou a branch por baixo (outra sessão, outro terminal). Se a troca foi intencional, confirme e libere rodando: rm '$sf'"
    fi
  fi
  printf '%s' "$branch" > "$sf" 2>/dev/null || true
  return 0
}

# $1 = diretório que um `git checkout`/`git switch` está prestes a rodar. A
# troca em si nunca é negada (é o mecanismo LEGÍTIMO de mudar de branch); só
# esquece o estado gravado desse worktree, pra não denunciar como "mudou por
# baixo" a próxima escrita depois de uma troca que este próprio hook já viu
# passar. Não tenta prever pra qual branch vai (parsear `-b`/`-c`/`-`/refspec
# com confiança não vale o risco de falso-negativo) — só reseta.
forget_worktree_state() {
  local dir="$1"
  while [ -n "$dir" ] && [ "$dir" != "/" ] && [ ! -d "$dir" ]; do
    dir=$(dirname -- "$dir")
  done
  [ -d "$dir" ] || return 0
  git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  local root
  root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || return 0
  rm -f "$STATE_DIR/$(state_key_for "$root")" 2>/dev/null || true
}

# Padrões de comando Bash que efetivamente mutam git ou arquivos — escopo
# deliberadamente conservador (ver Limitações conhecidas). `[[:space:]]`
# nunca espaço literal (mesma lição de pre-commit-checks.sh: espaçamento
# não-single-space não pode desligar o gate).
#
# `checkout`/`switch` NÃO entram em RE_GIT_MUTATE — têm handling próprio
# (RE_GIT_BRANCH_SWITCH, ver run_bash_check). Achado real de /code-review:
# como este hook roda ANTES do comando executar, check_worktree() só
# consegue ler a branch ATUAL (pré-troca) — gatear checkout/switch pela
# mesma lógica de mismatch registrava a branch antiga como "válida" e então
# a PRÓXIMA escrita nesse worktree (já na branch nova) era negada como se
# "alguém tivesse trocado por baixo", quando foi esta mesma sessão, com
# este mesmo hook já tendo aprovado a troca um passo antes.
RE_GIT_MUTATE='(^|[;&|(])[[:space:]]*git[[:space:]]+(-[A-Za-z-]+[[:space:]]+[^[:space:]]+[[:space:]]+)*(add|commit|push|merge|rebase|reset|stash|rm|mv|cherry-pick|revert|clean)\b'
RE_GIT_BRANCH_SWITCH='(^|[;&|(])[[:space:]]*git[[:space:]]+(-[A-Za-z-]+[[:space:]]+[^[:space:]]+[[:space:]]+)*(checkout|switch)\b'
RE_SED_INPLACE='(^|[;&|(])[[:space:]]*sed[[:space:]]+(-[A-Za-z]*i[A-Za-z]*|--in-place)\b'
RE_REDIRECT_WRITE='[[:space:]]>>?[[:space:]]*[^[:space:]&|;]'

resolve_effective_dir() {
  # Mesma lógica (cd líder, depois -C sobrescrevendo) de pre-commit-checks.sh
  # linhas 317-364 — já testada neste host contra macOS/BSD e GNU grep.
  local cmd_stripped="$1" cmd_raw="$2" orig_dir="$3"
  local repo_dir="$orig_dir"
  if [[ "$cmd_stripped" =~ (^|[\;\&\|])[[:space:]]*cd[[:space:]]+(\"([^\"]*)\"|\'([^\']*)\'|([^[:space:]]+))[[:space:]]*(\&\&|\;) ]]; then
    local cd_target="${BASH_REMATCH[3]:-${BASH_REMATCH[4]:-${BASH_REMATCH[5]}}}"
    if [ -z "$cd_target" ] && [[ "$cmd_raw" =~ (^|[\;\&\|])[[:space:]]*cd[[:space:]]+(\"([^\"]+)\"|\'([^\']+)\') ]]; then
      cd_target="${BASH_REMATCH[3]:-${BASH_REMATCH[4]}}"
    fi
    case "$cd_target" in
      /*) repo_dir="$cd_target" ;;
      *) repo_dir="$orig_dir/$cd_target" ;;
    esac
  fi
  if [[ "$cmd_stripped" =~ (^|[\;\&\|])[[:space:]]*git[[:space:]]+((-c[[:space:]]+[^[:space:]]+[[:space:]]+)*)-C[[:space:]]+(\"([^\"]*)\"|\'([^\']*)\'|([^[:space:]]+))[[:space:]]+ ]]; then
    local c_val="${BASH_REMATCH[5]:-${BASH_REMATCH[6]:-${BASH_REMATCH[7]}}}"
    if [ -z "$c_val" ] && [[ "$cmd_raw" =~ (^|[\;\&\|])[[:space:]]*git[[:space:]]+(-c[[:space:]]+[^[:space:]]+[[:space:]]+)*-C[[:space:]]+(\"([^\"]+)\"|\'([^\']+)\') ]]; then
      c_val="${BASH_REMATCH[4]:-${BASH_REMATCH[5]}}"
    fi
    if [ -n "$c_val" ]; then
      case "$c_val" in
        /*) repo_dir="$c_val" ;;
        *) repo_dir="$repo_dir/$c_val" ;;
      esac
    fi
  fi
  printf '%s' "$repo_dir"
}

run_bash_check() {
  local cmd="$1" orig_dir="$2"
  [ -z "$cmd" ] && return 0
  command -v python3 >/dev/null 2>&1 || return 0
  [ -f "$STRIP_PY" ] || return 0
  local cmd_stripped
  cmd_stripped=$(printf '%s' "$cmd" | python3 "$STRIP_PY" 2>/dev/null) || return 0

  local effective_dir
  effective_dir=$(resolve_effective_dir "$cmd_stripped" "$cmd" "$orig_dir")

  local is_switch=0 is_mutating=0
  printf '%s' "$cmd_stripped" | command grep -qE "$RE_GIT_BRANCH_SWITCH" && is_switch=1
  printf '%s' "$cmd_stripped" | command grep -qE "$RE_GIT_MUTATE" && is_mutating=1
  printf '%s' "$cmd_stripped" | command grep -qE "$RE_SED_INPLACE" && is_mutating=1
  printf '%s' "$cmd_stripped" | command grep -qE "$RE_REDIRECT_WRITE" && is_mutating=1

  if [ "$is_switch" -eq 1 ] && [ "$is_mutating" -eq 1 ]; then
    # Um comando ÚNICO que troca de branch E muta na mesma invocação — não
    # dá pra validar contra qual branch a mutação vai pousar de verdade
    # (o hook roda ANTES do checkout acontecer). Recusa em vez de arriscar
    # os dois lados errados: nem "esquece e libera" (perderia a checagem da
    # mutação) nem "valida contra a branch atual" (validaria a branch
    # ERRADA, a de antes da troca).
    deny "Comando recusado — mistura troca de branch (checkout/switch) com um comando que muta git/arquivo na MESMA chamada. Este hook roda antes do comando executar, então não dá pra validar contra a branch de destino. Rode a troca de branch numa chamada separada, depois o comando de escrita numa segunda chamada."
    return 0
  fi

  if [ "$is_switch" -eq 1 ]; then
    forget_worktree_state "$effective_dir"
    return 0
  fi

  [ "$is_mutating" -eq 0 ] && return 0
  check_worktree "$effective_dir"
}

if [ "${1:-}" = "--self-test" ]; then
  fail=0
  echo "[branch-guard] self-test" >&2

  for name in RE_GIT_MUTATE RE_GIT_BRANCH_SWITCH RE_SED_INPLACE RE_REDIRECT_WRITE; do
    eval "pat=\$$name"
    printf '' | command grep -qE "$pat"
    rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "FAIL: $name não compilou (grep exit $rc)" >&2
      fail=1
    else
      echo "OK  $name compilou" >&2
    fi
  done

  E2E_TMP=$(mktemp -d)
  # STATE_DIR isolado em diretório temporário — NUNCA o real. Achado real
  # de /code-review: antes deste export, o self-test rodava `rm -rf` no
  # `.branch-guard-state` de verdade (linha ~26 reatribuía STATE_DIR
  # incondicionalmente, ignorando o `STATE_DIR=... bash ...` que
  # run_hook_write tentava usar como isolamento — só isolava o processo
  # PAI do self-test, não os subprocessos que fazem o trabalho real).
  # Backup/restore do estado real (se existir) é defesa em profundidade
  # pro PRÓPRIO teste, caso a isolação acima regrida de novo no futuro.
  REAL_STATE_DIR="$HOOK_DIR/.branch-guard-state"
  REAL_STATE_BACKUP=""
  if [ -d "$REAL_STATE_DIR" ]; then
    REAL_STATE_BACKUP=$(mktemp -d)
    cp -R "$REAL_STATE_DIR/." "$REAL_STATE_BACKUP/" 2>/dev/null || true
  fi
  cleanup_e2e() {
    rm -rf "$E2E_TMP"
    if [ -n "$REAL_STATE_BACKUP" ]; then
      rm -rf "$REAL_STATE_DIR" 2>/dev/null || true
      mkdir -p "$REAL_STATE_DIR" 2>/dev/null || true
      cp -R "$REAL_STATE_BACKUP/." "$REAL_STATE_DIR/" 2>/dev/null || true
      rm -rf "$REAL_STATE_BACKUP"
    fi
  }
  trap cleanup_e2e EXIT
  export STATE_DIR="$E2E_TMP/state"

  # Repo "remoto" simples pra servir de origin dos worktrees de teste.
  git init -q --bare "$E2E_TMP/origin.git"
  git clone -q "$E2E_TMP/origin.git" "$E2E_TMP/seed" >/dev/null 2>&1
  (cd "$E2E_TMP/seed" && git config user.email t@t.com && git config user.name t \
    && echo x > f.txt && git add f.txt && git commit -q -m init \
    && git branch -M main && git push -q origin main)
  rm -rf "$E2E_TMP/seed"

  git clone -q "$E2E_TMP/origin.git" "$E2E_TMP/primary" >/dev/null 2>&1
  (cd "$E2E_TMP/primary" && git checkout -q -B main origin/main && git config user.email t@t.com && git config user.name t)
  (cd "$E2E_TMP/primary" && git worktree add -q -b feature/x "$E2E_TMP/wt-x" main >/dev/null 2>&1)

  run_hook_write() {
    local file_path="$1"
    python3 -c '
import json, sys
print(json.dumps({"tool_name": "Edit", "tool_input": {"file_path": sys.argv[1]}}))
' "$file_path" | STATE_DIR="$STATE_DIR" bash "$HOOK_DIR/branch-guard.sh" 2>&1
  }

  run_hook_bash() {
    local cmd="$1" cwd="$2"
    python3 -c '
import json, sys
print(json.dumps({"tool_name": "Bash", "tool_input": {"command": sys.argv[1]}, "cwd": sys.argv[2]}))
' "$cmd" "$cwd" | bash "$HOOK_DIR/branch-guard.sh" 2>&1
  }

  rm -rf "$STATE_DIR" 2>/dev/null || true

  out=$(run_hook_write "$E2E_TMP/primary/f.txt")
  if printf '%s' "$out" | command grep -q '"permissionDecision": *"deny"'; then
    echo "OK  e2e: Edit em worktree em main é negado" >&2
  else
    echo "FAIL e2e: Edit em worktree em main deveria ser negado — $out" >&2
    fail=1
  fi

  out=$(run_hook_write "$E2E_TMP/wt-x/f.txt")
  if ! printf '%s' "$out" | command grep -q '"permissionDecision"'; then
    echo "OK  e2e: Edit em worktree de feature (1ª vez) é permitido" >&2
  else
    echo "FAIL e2e: Edit em worktree de feature deveria ser permitido na 1ª vez — $out" >&2
    fail=1
  fi

  (cd "$E2E_TMP/wt-x" && git checkout -q -b feature/y)
  out=$(run_hook_write "$E2E_TMP/wt-x/f.txt")
  if printf '%s' "$out" | command grep -q '"permissionDecision": *"deny"'; then
    echo "OK  e2e: Edit é negado quando a branch do worktree mudou por baixo" >&2
  else
    echo "FAIL e2e: mismatch de branch deveria negar — $out" >&2
    fail=1
  fi

  wt_x_root=$(git -C "$E2E_TMP/wt-x" rev-parse --show-toplevel)
  sf="$STATE_DIR/$(state_key_for "$wt_x_root")"
  rm -f "$sf"
  out=$(run_hook_write "$E2E_TMP/wt-x/f.txt")
  if ! printf '%s' "$out" | command grep -q '"permissionDecision"'; then
    echo "OK  e2e: limpar o state libera a escrita de novo" >&2
  else
    echo "FAIL e2e: rm do state deveria liberar — $out" >&2
    fail=1
  fi

  rm -rf "$STATE_DIR" 2>/dev/null || true
  out=$(run_hook_bash "git add f.txt && git commit -m x" "$E2E_TMP/primary")
  if printf '%s' "$out" | command grep -q '"permissionDecision": *"deny"'; then
    echo "OK  e2e: Bash git-mutante em main (via cwd) é negado" >&2
  else
    echo "FAIL e2e: git add/commit rodando em main deveria ser negado — $out" >&2
    fail=1
  fi

  out=$(run_hook_bash "git status" "$E2E_TMP/primary")
  if ! printf '%s' "$out" | command grep -q '"permissionDecision"'; then
    echo "OK  e2e: Bash de leitura (git status) passa direto" >&2
  else
    echo "FAIL e2e: git status não deveria ser negado — $out" >&2
    fail=1
  fi

  rm -rf "$STATE_DIR" 2>/dev/null || true
  out=$(run_hook_bash "cd \"$E2E_TMP/wt-x\" && git add f.txt" "$E2E_TMP/primary")
  if ! printf '%s' "$out" | command grep -q '"permissionDecision"'; then
    echo "OK  e2e: cd + git add num worktree de feature é permitido" >&2
  else
    echo "FAIL e2e: cd + git add em worktree de feature deveria ser permitido — $out" >&2
    fail=1
  fi

  # Regressão do achado de /code-review: escrita num diretório que ainda
  # não existe (scaffolding de módulo novo) não pode pular o guard de
  # main/master só porque `[ -d "$dir" ]` falhava antes do walk-up.
  rm -rf "$STATE_DIR" 2>/dev/null || true
  out=$(run_hook_write "$E2E_TMP/primary/pasta/nova/ainda-nao-existe/f.txt")
  if printf '%s' "$out" | command grep -q '"permissionDecision": *"deny"'; then
    echo "OK  e2e: Write num diretório novo (ainda não existe) em main ainda é negado" >&2
  else
    echo "FAIL e2e: Write em diretório novo dentro de main deveria ser negado — $out" >&2
    fail=1
  fi

  # Regressão do achado de /code-review: `git checkout`/`switch` aprovado
  # por este hook não pode deixar a PRÓXIMA escrita nesse worktree presa
  # como "mudou por baixo" — a troca foi desta mesma sessão.
  rm -rf "$STATE_DIR" 2>/dev/null || true
  run_hook_write "$E2E_TMP/wt-x/f.txt" >/dev/null # semeia o state em feature/y
  out=$(run_hook_bash "git checkout -q -b feature/z" "$E2E_TMP/wt-x")
  if ! printf '%s' "$out" | command grep -q '"permissionDecision"'; then
    echo "OK  e2e: git checkout dentro de worktree de feature é permitido" >&2
  else
    echo "FAIL e2e: git checkout não deveria ser negado — $out" >&2
    fail=1
  fi
  (cd "$E2E_TMP/wt-x" && git checkout -q -b feature/z)
  out=$(run_hook_write "$E2E_TMP/wt-x/f.txt")
  if ! printf '%s' "$out" | command grep -q '"permissionDecision"'; then
    echo "OK  e2e: escrita depois de checkout aprovado por este hook NÃO é falsamente negada" >&2
  else
    echo "FAIL e2e: escrita pós-checkout não deveria ser negada (falso lockout) — $out" >&2
    fail=1
  fi

  rm -rf "$STATE_DIR" 2>/dev/null || true

  # Regressão do achado de /code-review: --self-test nunca pode apagar o
  # estado REAL de uma sessão em andamento (STATE_DIR precisa estar
  # isolado em $E2E_TMP, não em $REAL_STATE_DIR).
  if [ -n "$REAL_STATE_BACKUP" ] && [ -d "$REAL_STATE_DIR" ]; then
    if diff -rq "$REAL_STATE_BACKUP" "$REAL_STATE_DIR" >/dev/null 2>&1; then
      echo "OK  e2e: self-test não tocou no state real da sessão" >&2
    else
      echo "FAIL e2e: self-test alterou o state REAL — isolamento de STATE_DIR quebrado" >&2
      fail=1
    fi
  fi

  out=$(run_hook_bash "git checkout main && git commit -m x" "$E2E_TMP/wt-x")
  if printf '%s' "$out" | command grep -q '"permissionDecision": *"deny"'; then
    echo "OK  e2e: comando único que troca de branch E muta é recusado" >&2
  else
    echo "FAIL e2e: checkout+commit na mesma chamada deveria ser recusado — $out" >&2
    fail=1
  fi

  if [ "$fail" -eq 1 ]; then
    echo "Self-test do branch-guard FALHOU." >&2
    exit 1
  fi
  echo "Self-test do branch-guard OK." >&2
  exit 0
fi

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || exit 0
[ -z "$TOOL" ] && exit 0

case "$TOOL" in
  Write|Edit)
    FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
    [ -z "$FILE" ] && exit 0
    DIR=$(dirname -- "$FILE")
    check_worktree "$DIR"
    ;;
  Bash)
    CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
    ORIG_DIR=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null) || ORIG_DIR=""
    [ -z "$ORIG_DIR" ] && ORIG_DIR=$(pwd)
    run_bash_check "$CMD" "$ORIG_DIR"
    ;;
esac

exit 0

# Limitações conhecidas (não fechadas nesta versão — documentadas em vez de
# fingir cobertura total, mesmo padrão de docs/guardrails-processo.md):
# - RE_GIT_MUTATE/RE_SED_INPLACE/RE_REDIRECT_WRITE são um subconjunto
#   deliberadamente conservador de "comando que muta arquivo/git" — não é
#   exaustivo (ex.: `npm run format:fix`, `python3 -c` escrevendo em disco,
#   um script custom não batem). Miss aqui não é buraco de segurança nova —
#   só significa que este guard específico não pegou; o resto do repo segue
#   do jeito que estava antes dele existir.
# - Estado é global por worktree (não por sessão) — ver comentário no topo.
# - RE_GIT_MUTATE/RE_GIT_BRANCH_SWITCH duplicam (não compartilham) a lógica
#   de resolução de `cd`/`git -C` líder que pre-commit-checks.sh também tem
#   (linhas 317-364 daquele arquivo) — achado de /code-review: um fix futuro
#   numa cópia (ex.: um novo achado de regex frágil, como o histórico deste
#   repo já teve com classe POSIX descendente A-Z vs a-z) não propaga pra
#   outra automaticamente. Não foi unificado nesta PR porque a versão de
#   pre-commit-checks.sh é o gate que bloqueia commit — mexer nela pra
#   extrair uma lib compartilhada carrega risco de regressão num hook já
#   endurecido por >10 rodadas de review, maior que o custo de manter a
#   duplicação por ora. Se `resolve_effective_dir` for corrigida aqui,
#   revisar se pre-commit-checks.sh precisa do mesmo fix, e vice-versa.
# - Todo comando `Bash` (inclusive leitura pura — `ls`, `git status`) paga
#   um subprocesso `python3` extra pra stripar o comando, redundante com o
#   mesmo strip que pre-commit-checks.sh já faz pro mesmo comando no mesmo
#   dispatch de PreToolUse — achado de /code-review, aceito como custo fixo
#   por ora (dois hooks independentes, sem canal pra compartilhar o
#   resultado sem acoplar os dois arquivos).
