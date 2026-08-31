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

HOOK_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
STRIP_PY="$HOOK_DIR/strip-bash-command.py"

# Regexes do gate — definidas ANTES de ler stdin pra `--self-test` não
# bloquear no `cat`. Classe POSIX tem que ser `[A-Za-z]` (z minúsculo).
# `[A-Z` + `a-Z]` (Z maiúsculo) é range descendente: no BSD grep do
# macOS a regex INTEIRA recusa compilação (exit 2), e `if ! grep` vira
# sucesso — TODO `git commit` saía sem check (achado real nesta PR,
# commit 3e6fc776, corrigido em 9f770c5d). GNU grep no CI NÃO reproduz
# o erro de compilação; o `--self-test` recusa essa classe em
# linha de código e trata grep exit ≥2 como deny, não como "não é commit".
# Separadores usam `[[:space:]]+`, nunca espaço literal — achado real
# (@codex review xhigh, PR #134): esta regex era a ÚNICA do arquivo
# ainda usando ' ' literal entre tokens (as outras 4 já usavam
# [[:space:]]); `git  commit` (2 espaços) ou uma tab entre `git` e
# `commit` não batia, e como esta é o GATE MESTRE (decide se roda
# QUALQUER outro check), qualquer espaçamento não-single-space fazia
# o hook inteiro virar no-op.
GIT_GLOBAL='([[:space:]]+-C[[:space:]]+("[^"]*"|'"'"'[^'"'"']*'"'"'|[^[:space:]]+)|[[:space:]]+-c[[:space:]]+[^[:space:]]+)*'
# Âncora inclui `(` além de `^`/`;`/`&`/`|` — achado real (@codex
# review xhigh, PR #134): `$(...)` (e subshell `(...)` puro) abre um
# contexto de comando novo tanto quanto `;`/`&&`/`|`; sem `(` na
# âncora, um `git commit` de verdade escondido dentro de `$(...)`
# (ex.: `echo "$(git commit -am x)"`) já sobrevivia ao strip (o
# stripper preserva `$(...)` por ser bash live) mas a âncora não
# reconhecia `git` logo depois de `$(` como início de comando válido,
# então o gate ainda não disparava.
GIT_COMMIT_AT='(^|[;&|(])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:];&|]*[[:space:]]+)*git'"$GIT_GLOBAL"'[[:space:]]+commit($|[^a-zA-Z-])'
RE_FLAG_LONG='(^|[[:space:]])(--all|--include|--only|--patch|--interactive)($|[[:space:]=])'
RE_FLAG_SHORT='[[:space:]]-[a-zA-Z]*[ap][a-zA-Z]*($|[[:space:]])'
RE_FLAG_PATHSPEC='commit($|[^a-zA-Z-])([^;&|]*)[[:space:]]--[[:space:]]+[^[:space:]]'
RE_INDEX_MUT='(^|[;&|])[[:space:]]*git[[:space:]]+(add|rm|reset|stage)\b'

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
}

grep_ere() {
  # stdout silencioso; GREP_RC=0 match, 1 sem match, ≥2 erro de regex.
  printf '%s' "$2" | command grep -qE "$1"
  GREP_RC=${PIPESTATUS[1]:-2}
}

if [ "${1:-}" = "--self-test" ]; then
  fail=0
  # Caminho ABSOLUTO — achado real (CI, GitHub Actions): BASH_SOURCE[0]
  # preserva a forma como o script foi invocado; `bash .claude/hooks/
  # pre-commit-checks.sh --self-test` (como o workflow chama, relativo
  # ao repo root) deixa HOOK_SRC relativo, e os testes e2e abaixo, que
  # fazem `cd` pra um diretório de fixture antes de re-invocar o hook,
  # quebravam com "No such file or directory" (só reproduzia em CI —
  # localmente eu sempre testei com caminho absoluto). HOOK_DIR (linha
  # 14) já é absoluto via `cd -- ... && pwd`.
  HOOK_SRC="$HOOK_DIR/$(basename -- "${BASH_SOURCE[0]}")"
  echo "[pre-commit-checks] self-test" >&2
  # GNU grep aceita a classe descendente; o check que o CI consegue
  # reproduzir é o TEXTO da classe com Z maiúsculo em linha que não é
  # comentário. Concatena pra ESTE arquivo não conter o literal.
  typo_range=$(printf '%s%s' 'A-Z' 'a-Z')
  if command grep -nE "^[^#]*${typo_range}" "$HOOK_SRC"; then
    echo "FAIL: classe POSIX descendente (Z maiúsculo no lugar de z) em linha de código (quebraria o gate no BSD grep)." >&2
    fail=1
  else
    echo "OK  sem classe POSIX descendente em código" >&2
  fi
  for name in GIT_COMMIT_AT RE_FLAG_LONG RE_FLAG_SHORT RE_FLAG_PATHSPEC RE_INDEX_MUT; do
    eval "pat=\$$name"
    grep_ere "$pat" ""
    if [ "$GREP_RC" -ge 2 ]; then
      echo "FAIL: $name não compilou (grep exit $GREP_RC)" >&2
      fail=1
    else
      echo "OK  $name compilou" >&2
    fi
  done
  expect_match() {
    grep_ere "$GIT_COMMIT_AT" "$1"
    if [ "$GREP_RC" -eq 0 ]; then
      echo "OK  match: $2" >&2
    else
      echo "FAIL expected match (rc=$GREP_RC): $2" >&2
      fail=1
    fi
  }
  expect_no_match() {
    grep_ere "$GIT_COMMIT_AT" "$1"
    if [ "$GREP_RC" -eq 1 ]; then
      echo "OK  no-match: $2" >&2
    else
      echo "FAIL expected no-match (rc=$GREP_RC): $2" >&2
      fail=1
    fi
  }
  expect_flag() {
    local cmd="$1" label="$2"
    grep_ere "$RE_FLAG_LONG" "$cmd"
    local long_rc=$GREP_RC
    grep_ere "$RE_FLAG_SHORT" "$cmd"
    local short_rc=$GREP_RC
    grep_ere "$RE_FLAG_PATHSPEC" "$cmd"
    local path_rc=$GREP_RC
    if [ "$long_rc" -eq 0 ] || [ "$short_rc" -eq 0 ] || [ "$path_rc" -eq 0 ]; then
      echo "OK  flag-deny: $label" >&2
    else
      echo "FAIL expected flag-deny: $label" >&2
      fail=1
    fi
  }
  expect_no_flag() {
    local cmd="$1" label="$2"
    grep_ere "$RE_FLAG_LONG" "$cmd"
    local long_rc=$GREP_RC
    grep_ere "$RE_FLAG_SHORT" "$cmd"
    local short_rc=$GREP_RC
    grep_ere "$RE_FLAG_PATHSPEC" "$cmd"
    local path_rc=$GREP_RC
    if [ "$long_rc" -eq 1 ] && [ "$short_rc" -eq 1 ] && [ "$path_rc" -eq 1 ]; then
      echo "OK  no-flag: $label" >&2
    else
      echo "FAIL unexpected flag-deny (long=$long_rc short=$short_rc path=$path_rc): $label" >&2
      fail=1
    fi
  }
  expect_match 'git commit -m foo' 'git commit simples'
  expect_match 'echo "$(git commit -m foo)"' 'git commit dentro de $(...) — achado real, PR #134'
  expect_match 'FOO=1 git commit -m foo' 'prefixo VAR='
  expect_match 'git -c commit.gpgsign=false commit -m foo' 'git -c … commit'
  expect_match 'git commit&&echo x' 'commit sem espaço antes de &&'
  expect_no_match 'git status' 'git status'
  expect_no_match 'git commit-tree HEAD' 'commit-tree'
  # Achado real de @codex review xhigh, PR #134: GIT_COMMIT_AT era a
  # única regex do arquivo ainda usando espaço literal em vez de
  # [[:space:]]+ — 2 espaços ou uma tab entre tokens faziam o GATE
  # MESTRE não bater, e o hook inteiro virava no-op.
  expect_match "$(printf 'git  commit -m foo')" 'dois espaços entre git e commit'
  expect_match "$(printf 'git\tcommit -m foo')" 'tab entre git e commit'
  expect_match "$(printf 'FOO=1  git commit -m foo')" 'dois espaços depois do prefixo VAR='
  expect_flag 'git commit --patch -m foo' '--patch'
  expect_flag 'git commit -p -m foo' '-p'
  expect_flag 'git commit -pm foo' '-pm'
  expect_flag 'git commit --interactive' '--interactive'
  expect_flag 'git commit -am foo' '-am'
  expect_flag 'git commit -m foo -- src/x.ts' 'pathspec depois de --'
  expect_no_flag 'git commit -m foo' 'commit simples sem flag perigosa'
  expect_no_flag 'git commit --amend -m foo' '--amend não é --all'

  # Testes de PIPELINE COMPLETO — roda o hook DE VERDADE (não só as
  # regexes isoladas) contra repositórios git reais em diretórios
  # temporários, cobrindo a resolução de -C/cd e o strip-bash-
  # command.py ponta a ponta. Achado real (@codex review xhigh, PR
  # #134): --self-test só testava match/no-match de regex isolada;
  # nenhum desses achados (hijack de -C via texto de mensagem, cd +
  # -C relativo resolvendo no diretório errado, cd falhando depois do
  # -d passar, git commit escondido dentro de $(...), heredoc
  # aninhado com aspa solta vazando texto) era exercitado de verdade.
  E2E_TMP=$(mktemp -d)
  trap 'rm -rf "$E2E_TMP"' RETURN 2>/dev/null || true
  mkdir -p "$E2E_TMP/real_repo" "$E2E_TMP/outer/target_repo" "$E2E_TMP/decoy"
  for d in real_repo outer/target_repo decoy; do
    (cd "$E2E_TMP/$d" && git init -q && git config user.email t@t.com && git config user.name t)
  done

  run_hook() {
    # Invoca o script DE VERDADE (não --self-test) num subprocesso,
    # simulando o payload JSON que o Claude Code manda pro hook.
    local cmd="$1"
    python3 -c '
import json, sys
print(json.dumps({"tool_name": "Bash", "tool_input": {"command": sys.argv[1]}}))
' "$cmd" | bash "$HOOK_SRC" 2>&1
  }

  expect_e2e_repo_dir() {
    # A mensagem "... em $REPO_DIR" só sai em stderr — run_hook
    # funde stderr em stdout (achado real desta rodada: descartar
    # stderr fazia este teste nunca ver o REPO_DIR de verdade,
    # passando "verde" mesmo se a resolução tivesse regredido).
    local label="$1" cmd="$2" want_dir="$3"
    local out
    out=$(run_hook "$cmd")
    if printf '%s' "$out" | command grep -qF "$want_dir"; then
      echo "OK  e2e: $label" >&2
    else
      echo "FAIL e2e ($label): esperava REPO_DIR conter '$want_dir', saída: $out" >&2
      fail=1
    fi
  }

  expect_e2e_no_string() {
    local label="$1" cmd="$2" must_not="$3"
    local out
    out=$(run_hook "$cmd")
    if printf '%s' "$out" | command grep -qF "$must_not"; then
      echo "FAIL e2e ($label): saída não deveria conter '$must_not' — $out" >&2
      fail=1
    else
      echo "OK  e2e: $label" >&2
    fi
  }

  # -C hijack via texto de mensagem (achado real): a mensagem cita um
  # -C de outro diretório — o hook NUNCA pode validar o índice desse
  # decoy.
  expect_e2e_no_string '-C hijack via texto de mensagem não redireciona' \
    "git -C \"$E2E_TMP/real_repo\" commit -m 'note: also tried -C \"$E2E_TMP/decoy\" earlier'" \
    "$E2E_TMP/decoy"
  # cd + -C relativo resolve contra o diretório do cd, não ORIG_DIR.
  expect_e2e_repo_dir 'cd + -C relativo resolve no diretório certo' \
    "cd \"$E2E_TMP/outer\" && git -C target_repo commit -m x" \
    "$E2E_TMP/outer/target_repo"
  # git commit escondido dentro de $(...) precisa disparar os checks —
  # antes desta correção, o hook saía em silêncio total (stdout vazio,
  # exit 0, indistinguível de "não reconheci como git commit"). O
  # sinal de que reconheceu é a linha "git commit detectado" em
  # stderr, então roda com stderr redirecionado pro mesmo stream.
  out=$(cd "$E2E_TMP/real_repo" && printf '%s' '{"tool_name":"Bash","tool_input":{"command":"echo \"$(git commit -m clean)\""}}' | bash "$HOOK_SRC" 2>&1)
  if printf '%s' "$out" | command grep -q "git commit detectado"; then
    echo "OK  e2e: git commit escondido em \$(...) é reconhecido" >&2
  else
    echo "FAIL e2e: git commit escondido em \$(...) não foi reconhecido — $out" >&2
    fail=1
  fi

  if [ "$fail" -eq 1 ]; then
    echo "Self-test do hook FALHOU." >&2
    exit 1
  fi
  echo "Self-test do hook OK." >&2
  exit 0
fi

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')

# **Remove o CONTEÚDO de strings/heredoc ANTES de qualquer detecção** —
# não trunca na primeira `-m`/heredoc, apaga o conteúdo de aspas
# simples/duplas (mantendo as aspas em si, só pra preservar posição/
# vazio-mas-presente) e de corpos de heredoc (`<<EOF ... EOF`) até a
# linha que é só o delimitador. Sobra só a estrutura real do comando
# (flags, `-C`, operadores) — nunca texto de mensagem de commit.
# Achados reais de @codex review, todos self-inflicted (bloquearam
# commits de verdade DESTA própria correção, sessão a sessão): (1)
# extrator de `-C` sem esse strip batia dentro do TEXTO da mensagem —
# "só `git -C dir commit`" como exemplo virava um -C de verdade
# apontando pro diretório literal "dir"; pior, uma mensagem citando
# `; git -C /outro/repo commit` conseguia REDIRECIONAR os checks pra
# rodar contra o índice de outro repositório real, não o que está
# sendo commitado. (2) rejeição de -a/--all truncando na 1ª `-m`
# perdia flags que vêm DEPOIS da mensagem (`git commit -m "msg" -a` é
# válido, git aceita flag em qualquer ordem). Lógica movida pra
# strip-bash-command.py (round 11, @codex review xhigh, PR #134):
# viver como heredoc bash-single-quote-escapado dentro DESTE arquivo
# foi a causa raiz de vários desses achados self-inflicted — um .py
# separado não tem escaping de aspas nenhum pra errar. Também fecha 2
# achados novos: `$(...)` dentro de aspas duplas é bash LIVE (pode
# esconder um `git commit` de verdade) mas a versão anterior apagava
# o conteúdo inteiro das aspas duplas, incluindo a substituição —
# agora recursa nela. E o heredoc só reconhecia delimitador citado
# (`'EOF'`/`"EOF"`); `<<\EOF` (escape de barra) também suprime
# expansão em bash de verdade e não era reconhecido, deixando o corpo
# inteiro sem strip.
CMD_STRIPPED=$(printf '%s' "$CMD" | python3 "$STRIP_PY")

# Só age em comandos que efetivamente rodam `git commit` (aceita `git -C dir`
# com dir citado ou não, encadeado com && / ; / |, sem espaço antes do
# separador). Não bloqueia nenhum outro comando Bash. Roda contra
# CMD_STRIPPED (não CMD) pela mesma razão acima — texto de mensagem não
# deve conseguir simular um "git commit" real.
# Achado real de /code-review ultra local (PR #134): a versão anterior
# exigia espaço ou fim-de-string logo após "commit" (`commit( |$)`), então
# `git commit&&git push`/`git commit;git push` (sem espaço antes do
# separador) bypassavam o gate inteiro sem erro nem aviso. Fix: qualquer
# caractere NÃO-alfabético (ou fim de string) depois de "commit" conta como
# boundary — `commit($|[^a-zA-Z-])` — hífen fica de fora pra não
# disparar em `git commit-tree`/`git commit-graph`. -C aceita path
# entre aspas (simples ou duplas) além de sem aspas, pra não perder
# `git -C "dir com espaço" commit`.
# Também aceita opções globais entre `git` e `commit` (`-c key=val`,
# `-C` repetido) e prefixo `VAR=val` — senão `git -c commit.gpgsign=false
# commit -am ...` e `FOO=1 git commit` saíam do hook sem check nenhum
# (achado real de @cursoragent review, PR #134). Typo de classe POSIX
# com Z maiúsculo no lugar de z (range descendente a..Z) quebra a
# regex INTEIRA em tempo de COMPILAÇÃO no BSD grep do macOS — TODO
# `git commit`, não só os com prefixo VAR=, saía sem check nenhum
# (grep -qE retorna erro, `! grep` vira sucesso, hook inteiro dá
# exit 0 cedo). `bash -n` não pega; GNU grep no CI pode não reproduzir.
# `if ! grep` com regex inválida (exit 2) vira sucesso e o hook dava
# exit 0 — fail-OPEN. Agora exit ≥2 recusa o commit.
grep_ere "$GIT_COMMIT_AT" "$CMD_STRIPPED"
if [ "$GREP_RC" -ge 2 ]; then
  deny "Commit bloqueado — a regex que detecta git commit falhou ao compilar (grep exit $GREP_RC). Recusando por segurança em vez de liberar o commit."
  exit 0
fi
if [ "$GREP_RC" -ne 0 ]; then
  exit 0
fi

ORIG_DIR=$(pwd)
REPO_DIR="$ORIG_DIR"
# Resolução de diretório em 2 passos SEQUENCIAIS (reescrito, achado real
# de @codex review xhigh, PR #134): (1) um `cd <dir> &&`/`;` líder,
# ANTES do `git`, define a base — some se não existir, senão vira o
# novo REPO_DIR. (2) um `-C <dir>` explícito, se existir, SOBRESCREVE
# REPO_DIR, resolvido relativo à base já calculada no passo 1 (não
# direto de ORIG_DIR). Unifica os 2 branches se/elif antigos, que
# tinham 2 bugs: (a) o branch de `-C` (checado PRIMEIRO, e que casava
# sempre que havia `-C`, com ou sem `cd` líder — `cd X && git -C Y
# commit` cai nele, não no elif) nunca considerava um `cd` líder,
# então um `-C` RELATIVO resolvia contra ORIG_DIR em vez da base real
# em tempo de execução (`cd /tmp/outer && git -C ../target commit`
# validava o índice do diretório ERRADO). (b) o branch cd-only
# (elif, só alcançável sem `-C`) ficava morto pro caso combinado.
# Extrai sempre de CMD_STRIPPED (não CMD) — mensagem/heredoc já
# viraram aspas-vazias ali, então um match é garantidamente estrutura
# real, nunca texto de mensagem. Valor `""`/`''` vazio (era um alvo
# QUOTED cujo conteúdo o strip apagou) recupera do CMD original com a
# MESMA âncora — nesse ponto já sabemos que existe um `-C`/`cd` real
# nessa posição, então buscar o VALOR no CMD original é seguro (não
# usa `.*` guloso — âncora fixa no MESMO ponto já confirmado real).
if [[ "$CMD_STRIPPED" =~ (^|[\;\&\|])[[:space:]]*cd[[:space:]]+(\"([^\"]*)\"|\'([^\']*)\'|([^[:space:]]+))[[:space:]]*(\&\&|\;) ]]; then
  CD_TARGET="${BASH_REMATCH[3]:-${BASH_REMATCH[4]:-${BASH_REMATCH[5]}}}"
  if [ -z "$CD_TARGET" ] && [[ "$CMD" =~ (^|[\;\&\|])[[:space:]]*cd[[:space:]]+(\"([^\"]+)\"|\'([^\']+)\') ]]; then
    CD_TARGET="${BASH_REMATCH[3]:-${BASH_REMATCH[4]}}"
  fi
  case "$CD_TARGET" in
    /*) REPO_DIR="$CD_TARGET" ;;
    *) REPO_DIR="$ORIG_DIR/$CD_TARGET" ;;
  esac
fi
if [[ "$CMD_STRIPPED" =~ (^|[\;\&\|])[[:space:]]*git[[:space:]]+((-c[[:space:]]+[^[:space:]]+[[:space:]]+)*)-C[[:space:]]+(\"([^\"]*)\"|\'([^\']*)\'|([^[:space:]]+))[[:space:]]+((-c[[:space:]]+[^[:space:]]+[[:space:]]+)*)commit ]]; then
  # Grupos: (1) prefixo (2-3) `-c` antes do `-C` (4) path com aspas
  # (5) duplas (6) simples (7) sem aspas.
  C_VAL="${BASH_REMATCH[5]:-${BASH_REMATCH[6]:-${BASH_REMATCH[7]}}}"
  if [ -z "$C_VAL" ] && [[ "$CMD" =~ (^|[\;\&\|])[[:space:]]*git[[:space:]]+(-c[[:space:]]+[^[:space:]]+[[:space:]]+)*-C[[:space:]]+(\"([^\"]+)\"|\'([^\']+)\') ]]; then
    C_VAL="${BASH_REMATCH[4]:-${BASH_REMATCH[5]}}"
  fi
  if [ -z "$C_VAL" ]; then
    deny "Commit bloqueado — git -C sem valor reconhecível."
    exit 0
  fi
  case "$C_VAL" in
    /*) REPO_DIR="$C_VAL" ;;
    *) REPO_DIR="$REPO_DIR/$C_VAL" ;;
  esac
fi
if [ ! -d "$REPO_DIR" ]; then
  deny "Commit bloqueado — $REPO_DIR não é um diretório."
  exit 0
fi
# Fail-CLOSED se o cd falhar mesmo depois do -d acima passar (achado
# real de @codex review xhigh, PR #134: permissão negada / TOCTOU
# entre o -d e o cd deixava `|| exit 0` aprovar o commit sem check
# nenhum, único caminho de falha deste arquivo que não negava).
cd "$REPO_DIR" || { deny "Commit bloqueado — falha ao entrar em $REPO_DIR (permissão negada ou removido entre o check e o cd)."; exit 0; }
REPO_DIR=$(pwd)

# `-a`/`--all`/`--include`/`--only`/`--patch`/`-p`/`--interactive` e
# pathspec depois de `--` fazem o commit gravar MAIS (ou diferente) do
# que o índice atual — `git write-tree` abaixo só reflete o que já está
# staged AGORA, não o que essas opções vão adicionar durante o próprio
# `git commit`. Negar em vez de validar um snapshot que não é o que será
# gravado de verdade (achado real de /code-review ultra local, PR #134:
# `git commit -am "..."` com índice limpo pulava todo check e commitava
# working-tree TS não validado). `--patch`/`-p`/`--interactive` implicam
# `--include` (git commit -h) e não estavam no deny — o hook validava o
# índice e o git depois stageava hunks extra (achado real de
# @cursoragent review, PR #134). Flags são procuradas no comando
# STRIPPED inteiro (não só coladas em `git commit`) pra `git -c x=y
# commit -am` não escapar do deny.
if printf '%s' "$CMD_STRIPPED" | command grep -qE "$RE_FLAG_LONG" \
  || printf '%s' "$CMD_STRIPPED" | command grep -qE "$RE_FLAG_SHORT" \
  || printf '%s' "$CMD_STRIPPED" | command grep -qE "$RE_FLAG_PATHSPEC"; then
  deny "Commit bloqueado — 'git commit -a/--all/--include/--only/--patch/-p/--interactive' (ou pathspec depois de --) grava mais do que o índice atual, e este hook só valida o snapshot já staged. Rode 'git add' explícito nos arquivos e um 'git commit' simples (sem essas flags)."
  exit 0
fi

# `git add ... && git commit ...` (ou `git rm --cached`/`git reset`/
# `git stage` antes de commit) no MESMO comando — achado real de
# @codex review, PR #134: este hook PreToolUse roda ANTES de QUALQUER
# parte do comando executar de verdade, então `git write-tree` acima
# materializa o índice de ANTES do `git add` acontecer — o snapshot
# validado é o ERRADO (índice antigo/vazio), e o `git add` real que
# segue stage o arquivo sem NUNCA ter sido validado. Não dá pra
# reconstruir com segurança o índice que esses comandos vão produzir
# sem executá-los de verdade antes da hora (efeito colateral indevido
# num hook Pre); nega e pede pra rodar em 2 chamadas separadas — a
# 2ª chamada (só `git commit`) faz este hook rodar de novo, agora com
# o índice já staged de verdade.
if printf '%s' "$CMD_STRIPPED" | command grep -qE "$RE_INDEX_MUT" \
  && printf '%s' "$CMD_STRIPPED" | command grep -qE "$GIT_COMMIT_AT"; then
  deny "Commit bloqueado — este comando mistura 'git add/rm/reset/stage' com 'git commit' numa chamada só. Este hook roda ANTES do comando executar, então o índice validado seria o de ANTES do add/rm/reset — não o que será commitado de verdade. Rode o add/rm/reset numa chamada separada, depois um 'git commit' simples numa segunda chamada."
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
done < <(git diff --cached --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' 2>/dev/null | command grep -v '^\.claude/worktrees/' || true)

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
TS_DELETED=$(git diff --cached --name-only --diff-filter=D -- '*.ts' '*.tsx' 2>/dev/null | command grep -v '^\.claude/worktrees/' || true)
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
