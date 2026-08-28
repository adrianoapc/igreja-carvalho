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
# válido, git aceita flag em qualquer ordem).
CMD_STRIPPED=$(printf '%s' "$CMD" | python3 -c '
import re, sys

s = sys.stdin.read()
out = []
i, n = 0, len(s)
while i < n:
    c = s[i]
    if c == "\"":
        j = i + 1
        while j < n:
            if s[j] == "\\" and j + 1 < n:
                j += 2
                continue
            if s[j] == "\"":
                j += 1
                break
            j += 1
        out.append("\"\"")
        i = j
        continue
    if c == "'"'"'":
        j = i + 1
        while j < n and s[j] != "'"'"'":
            j += 1
        j += 1
        out.append("'"'"''"'"'")
        i = j
        continue
    if s[i : i + 2] == "<<":
        m = re.match(r"<<-?\s*([\"'"'"']?)([A-Za-z_][A-Za-z0-9_]*)\1", s[i:])
        if m:
            delim = m.group(2)
            body_start = i + m.end()
            end_re = re.compile(r"(?m)^[ \t]*" + re.escape(delim) + r"[ \t]*$")
            em = end_re.search(s, body_start)
            out.append(s[i:body_start])
            i = em.end() if em else n
            continue
    out.append(c)
    i += 1
sys.stdout.write("".join(out))
')

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
# (achado real de @cursoragent review, PR #134).
GIT_GLOBAL='( -C ("[^"]*"|'"'"'[^'"'"']*'"'"'|[^ ]+)| -c [^ ]+)*'
GIT_COMMIT_AT='(^|[;&|]) *([A-Za-Z_][A-Za-Z0-9_]*=[^ ;&|]* )*git'"$GIT_GLOBAL"' commit($|[^a-zA-Z-])'
if ! printf '%s' "$CMD_STRIPPED" | grep -qE "$GIT_COMMIT_AT"; then
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
# Extrai o alvo de `git -C` a partir de CMD_STRIPPED (não CMD) — o
# gate/âncora roda sobre texto onde mensagem/heredoc já viraram
# aspas-vazias, então um `-C` "achado" ali é garantidamente um -C real
# do comando, nunca conteúdo de mensagem. Se o valor capturado vier
# vazio (`""`/`''` — era um -C real só que com path QUOTED, cujo
# conteúdo o strip apagou), recupera o valor de verdade do CMD
# original com a MESMA âncora — nesse ponto já sabemos que existe um
# -C real nessa posição, então buscar o valor no CMD original é seguro.
if [[ "$CMD_STRIPPED" =~ (^|[\;\&\|])[[:space:]]*git[[:space:]]+((-c[[:space:]]+[^[:space:]]+[[:space:]]+)*)-C[[:space:]]+(\"([^\"]*)\"|\'([^\']*)\'|([^[:space:]]+))[[:space:]]+((-c[[:space:]]+[^[:space:]]+[[:space:]]+)*)commit ]]; then
  # Grupos: (1) prefixo (2-3) `-c` antes do `-C` (4) path com aspas
  # (5) duplas (6) simples (7) sem aspas.
  REPO_DIR="${BASH_REMATCH[5]:-${BASH_REMATCH[6]:-${BASH_REMATCH[7]}}}"
  if [ -z "$REPO_DIR" ] && [[ "$CMD" =~ (^|[\;\&\|])[[:space:]]*git[[:space:]].*-C[[:space:]]+(\"([^\"]+)\"|\'([^\']+)\') ]]; then
    REPO_DIR="${BASH_REMATCH[3]:-${BASH_REMATCH[4]}}"
  fi
  if [ -z "$REPO_DIR" ] || [ ! -d "$REPO_DIR" ]; then
    deny "Commit bloqueado — git -C $REPO_DIR não é um diretório."
    exit 0
  fi
  cd "$REPO_DIR" || exit 0
  REPO_DIR=$(pwd)
elif [[ "$CMD_STRIPPED" =~ (^|[\;\&\|])[[:space:]]*cd[[:space:]]+(\"([^\"]*)\"|\'([^\']*)\'|([^[:space:]]+))[[:space:]]*(\&\&|\;)[[:space:]]*git[[:space:]]+((-C[[:space:]]+(\"([^\"]*)\"|\'([^\']*)\'|[^[:space:]]+)|-c[[:space:]]+[^[:space:]]+)[[:space:]]+)*commit ]]; then
  # `cd <dir> && git commit` (ou `;`) no MESMO comando — achado real de
  # /code-review ultra local, PR #134: só `-C` era reconhecido; um `cd`
  # explícito antes do `git commit` fazia todo check rodar no diretório
  # ERRADO (o `cd` do comando ainda não rodou de verdade quando o hook
  # PreToolUse é avaliado — roda ANTES da tool, não depois).
  REPO_DIR="${BASH_REMATCH[3]:-${BASH_REMATCH[4]:-${BASH_REMATCH[5]}}}"
  if [ -z "$REPO_DIR" ] && [[ "$CMD" =~ (^|[\;\&\|])[[:space:]]*cd[[:space:]]+(\"([^\"]+)\"|\'([^\']+)\') ]]; then
    REPO_DIR="${BASH_REMATCH[3]:-${BASH_REMATCH[4]}}"
  fi
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
if printf '%s' "$CMD_STRIPPED" | grep -qE '(^|[[:space:]])(--all|--include|--only|--patch|--interactive)($|[[:space:]=])' \
  || printf '%s' "$CMD_STRIPPED" | grep -qE '[[:space:]]-[a-zA-Z]*[ap][a-zA-Z]*($|[[:space:]])' \
  || printf '%s' "$CMD_STRIPPED" | grep -qE 'commit($|[^a-zA-Z-])([^;&|]*)[[:space:]]--[[:space:]]+[^[:space:]]'; then
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
if printf '%s' "$CMD_STRIPPED" | grep -qE '(^|[;&|])[[:space:]]*git[[:space:]]+(add|rm|reset|stage)\b' \
  && printf '%s' "$CMD_STRIPPED" | grep -qE "$GIT_COMMIT_AT"; then
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
