#!/usr/bin/env bash
# Scanner dos 3 padrões de bug recorrente. Invocado por
# `.github/workflows/pattern-guardrails.yml`. Também aceita `--self-test`
# pra validar os detectores sem um diff de PR.
#
# Regras (com PRs de origem em docs/guardrails-processo.md):
#   1. `.eq("filial_id"` é o bug — PostgREST ANDa filtros, então um
#      `.or("filial_id.is.null")` por perto NÃO reabilita as linhas
#      globais. Escape: `// filial-global-ok`.
#   2. `.delete(` / `.update(` do Supabase precisa de `count: "exact"`
#      NOS ARGUMENTOS DESTA call, não numa irmã a 12 linhas. Escape:
#      `// count-exact-ok`.
#   3. `color: STATUS_COLOR` (tinta, não fundo de pill).
set -uo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MUTATION_ARGS_PY="$SCRIPT_DIR/mutation-call-args.py"
STRIP_TS_TEXT_PY="$SCRIPT_DIR/strip-ts-text.py"

# Extrai o texto entre o `(` do `.delete(` / `.update(` na linha dada e
# o `)` que fecha ESSA call (pula strings). Assim `count: "exact"` duma
# call irmã não protege outra. Script separado (não heredoc) pra não
# roubar o stdin do `while read` do detector.
mutation_call_args() {
  if [ -n "${3:-}" ]; then
    python3 "$MUTATION_ARGS_PY" "$1" "$2" "$3"
  else
    python3 "$MUTATION_ARGS_PY" "$1" "$2"
  fi
}

in_scope() {
  local lineno="$1"
  printf '%s\n' "$SCOPE_LINES" | grep -qx "$lineno"
}

window() {
  local file="$1" lineno="$2" before="$3" after="$4"
  local start end
  start=$((lineno > before ? lineno - before : 1))
  end=$((lineno + after))
  sed -n "${start},${end}p" "$file"
}

# ------------------------------------------------------------
# Detectores. Imprimem `::error` e retornam 1 se achar.
# ------------------------------------------------------------
check_filial_eq() {
  local f="$1" fail=0
  local lineno win
  while IFS=: read -r lineno _; do
    [ -z "$lineno" ] && continue
    in_scope "$lineno" || continue
    # Janela MESMA LINHA só (achado real de /code-review ultra local,
    # PR #134: janela de 5-antes/2-depois deixava um `//
    # filial-global-ok` perto de UM .eq("filial_id"...) exemptar um
    # SEGUNDO .eq("filial_id"...) diferente na mesma vizinhança —
    # nenhum self-test precisa de escape fora da própria linha, então
    # apertar não quebra nada legítimo, só fecha o vazamento entre
    # calls vizinhas).
    win=$(window "$f" "$lineno" 0 0)
    if echo "$win" | grep -q '// filial-global-ok'; then
      continue
    fi
    echo "::error file=${REPORT_FILE:-$f},line=$lineno::.eq(\"filial_id\"...) exclui filial_id IS NULL mesmo se houver .or(...) no mesmo chain (PostgREST ANDa os filtros). Substitua o .eq por .or(\"filial_id.eq.X,filial_id.is.null\"), ou // filial-global-ok se a exclusão de globais for intencional. Ver CLAUDE.md §Filial compartilhada."
    fail=1
  done < <(grep -n '\.eq(["'"'"']filial_id["'"'"']' "$f" || true)
  return "$fail"
}

is_supabase_mutation_ctx() {
  local ctx="$1"
  echo "$ctx" | grep -qE '\.from\(["'"'"']|supabase[A-Za-z]*\.'
}

# Confirma que o .delete()/.update() na linha `lineno` de fato pertence a
# um chain do Supabase, não só que "supabase"/.from( aparece em algum
# lugar dentro de uma janela de N linhas (achado real de @codex review,
# PR #134: `await supabase.from("items").select();` seguido, um pouco
# depois, de `selectedIds.delete(id)` [Set.delete de verdade] classificava
# o Set.delete como mutation Supabase, só por estar na mesma janela de 13
# linhas — nenhuma relação de chain real entre os dois). Anda pra trás a
# partir da linha da call: linha em branco pula; linha terminada em `;`
# é um statement COMPLETO anterior — não pode ser continuação do chain
# atual, para a busca; linha com `.from(["']`/`supabase\.` = achou o
# início do chain. Statements terminados em `;` são o sinal de fronteira
# real (um chain multi-linha não-terminado nunca tem `;` no meio).
# Isola o trecho da linha ate' (e incluindo) o match `idx` (1-based) de
# .delete(/.update(, cortando em `;` — evita que um 2º statement na
# MESMA linha física herde o contexto supabase de um 1º statement
# totalmente diferente (achado real de @codex review, PR #134:
# `await supabase.from("items").select(); selectedIds.delete(id);` os
# dois na mesma linha — sem isolar por segmento, o Set.delete via
# supabase.from( no INÍCIO da mesma linha, mesmo depois do `;`).
mutation_line_segment() {
  local f="$1" lineno="$2" idx="$3" line seg running=0 n_in_seg
  line=$(sed -n "${lineno}p" "$f")
  local IFS=';'
  local -a segs
  read -ra segs <<< "$line"
  for seg in "${segs[@]}"; do
    n_in_seg=$(printf '%s\n' "$seg" | grep -oE '\.(delete|update)\(' | wc -l | tr -d ' ')
    if [ "$((running + n_in_seg))" -ge "$idx" ]; then
      printf '%s' "$seg"
      return 0
    fi
    running=$((running + n_in_seg))
  done
  printf '%s' "$line"
}

mutation_belongs_to_chain() {
  local f="$1" lineno="$2" idx="${3:-}" line prev i trimmed
  if [ -n "$idx" ]; then
    line=$(mutation_line_segment "$f" "$lineno" "$idx")
  else
    line=$(sed -n "${lineno}p" "$f")
  fi
  is_supabase_mutation_ctx "$line" && return 0
  i=$((lineno - 1))
  local floor=$((lineno > 10 ? lineno - 10 : 1))
  while [ "$i" -ge "$floor" ]; do
    prev=$(sed -n "${i}p" "$f")
    trimmed=$(printf '%s' "$prev" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')
    if [ -z "$trimmed" ]; then
      i=$((i - 1))
      continue
    fi
    if is_supabase_mutation_ctx "$trimmed"; then
      return 0
    fi
    case "$trimmed" in
      *\;) return 1 ;;  # statement anterior completo — não é meu chain
    esac
    i=$((i - 1))
  done
  return 1
}

check_mutations() {
  local f="$1" fail=0
  local lineno args win nmatches idx line
  # Itera por MATCH, não por linha (achado real de /code-review ultra
  # local, PR #134): `grep -n` reporta uma linha que casa 1x mesmo com
  # 2+ ocorrências (`Promise.all([a.delete(), b.delete({count:"exact"})])`)
  # — um loop por linha só validaria a última call, deixando a primeira
  # sem checar. mutation_call_args aceita índice (1-based) do match na
  # linha pra isolar os argumentos de CADA call separadamente.
  while IFS=: read -r lineno _; do
    [ -z "$lineno" ] && continue
    in_scope "$lineno" || continue
    line=$(sed -n "${lineno}p" "$f")
    nmatches=$(printf '%s\n' "$line" | grep -oE '\.(delete|update)\(' | wc -l | tr -d ' ')
    [ "${nmatches:-0}" -eq 0 ] && continue
    # .from\(["'] exige aspas logo após o parêntese — bate em
    # .from("tabela") do Supabase, não em Array.from(x) (achado real:
    # Array.from(selectedChildren) perto de Set.delete disparava).
    # Janela MESMA LINHA só, mesma razão do check_filial_eq acima
    # (achado real de /code-review ultra local, PR #134: `//
    # count-exact-ok` de UMA call vazava pra proteger uma call
    # DIFERENTE 1-3 linhas antes).
    win=$(window "$f" "$lineno" 0 0)
    if echo "$win" | grep -q '// count-exact-ok'; then
      continue
    fi
    idx=1
    while [ "$idx" -le "$nmatches" ]; do
      # mutation_belongs_to_chain checado POR MATCH (índice), não uma
      # vez pra linha inteira — achado real de @codex review, PR #134:
      # `await supabase.from("items").select(); selectedIds.delete(id);`
      # tem os 2 statements na MESMA linha física; checar a linha
      # inteira deixava o 1º supabase.from( "vazar" contexto pro
      # Set.delete depois do `;`. mutation_line_segment isola só o
      # trecho do statement ATÉ este match específico.
      if mutation_belongs_to_chain "$f" "$lineno" "$idx"; then
        args=$(mutation_call_args "$f" "$lineno" "$idx" 2>/dev/null || true)
        if ! printf '%s' "$args" | grep -qE 'count:[[:space:]]*["'"'"']exact["'"'"']'; then
          echo "::error file=${REPORT_FILE:-$f},line=$lineno::.delete()/.update() do Supabase sem { count: \"exact\" } NESTA call (match $idx de $nmatches nesta linha) — se o RLS negar, retorna error:null/0 linhas e o código pode reportar sucesso falso (PR #126). Adicione { count: \"exact\" } no argumento desta call (não numa irmã) e cheque o count retornado, ou // count-exact-ok se a call já é auto-limitada por PK/id único."
          fail=1
        fi
      fi
      idx=$((idx + 1))
    done
  done < <(grep -nE '\.(delete|update)\(' "$f" || true)
  return "$fail"
}

check_status_color() {
  local f="$1" fail=0
  local lineno
  while IFS=: read -r lineno _; do
    [ -z "$lineno" ] && continue
    in_scope "$lineno" || continue
    echo "::error file=${REPORT_FILE:-$f},line=$lineno::STATUS_COLOR é cor de FUNDO de pill, não tinta de texto — usar como \`color:\` falha contraste WCAG 3:1 em card claro (PR #114). Use pillStyle(tone) de statusPalette.ts."
    fail=1
  done < <(grep -nE 'color:[[:space:]]*STATUS_COLOR' "$f" || true)
  return "$fail"
}

check_chart_hex_warning() {
  local f="$1" hex_count
  # Aviso (não bloqueia): 3+ literais hex em QUALQUER .ts/.tsx tocado.
  # Achado real de /code-review ultra local (PR #134): exigir
  # COLORS/colors= na MESMA linha E path com dashboard/chart fazia o
  # aviso nunca disparar nos 5 arquivos que chartPalette.ts cita
  # (Insights.tsx tem array multi-linha; Candidatos.tsx nem tem
  # "dashboard"/"chart" no path).
  hex_count=$(grep -oE '#[0-9A-Fa-f]{6}' "$f" 2>/dev/null | wc -l | tr -d ' ')
  if [ "${hex_count:-0}" -ge 3 ]; then
    echo "::warning file=$f::${hex_count} cores hex hardcoded — considere usar src/lib/chartPalette.ts (CHART_SERIES_COLORS/chartColor) em vez de hex fixo, pra herdar dark mode automaticamente."
  fi
}

scope_lines_for_file() {
  local f="$1" base_sha="$2"
  # Linhas em escopo: as que a PR ADICIONOU (número na versão nova) MAIS
  # uma margem de 10 linhas SÓ em torno de hunks só-de-remoção (ex.:
  # apagar só `{ count: "exact" }` de um .delete() multi-linha, que não
  # tem linha "adicionada" nenhuma pra ancorar o escopo). Hunk com linha
  # adicionada de verdade usa EXATAMENTE as linhas adicionadas, sem
  # margem — achado real de @codex review, PR #134: a margem de 10
  # aplicada a QUALQUER hunk (inclusive addition-only) fazia adicionar
  # 1 linha nova perto de um `.eq("filial_id"...)`/mutation/
  # STATUS_COLOR legado (não tocado por esta PR) travar o check
  # obrigatório mesmo sem essa PR ter introduzido ou alterado o padrão
  # — este repo documenta ter várias ocorrências legadas assim.
  # Padrão pré-existente fora de qualquer hunk nunca entra.
  git diff -U0 "$base_sha"...HEAD -- "$f" 2>/dev/null \
    | grep -oP '^@@ -[0-9]+(,[0-9]+)? \+\K[0-9]+(,[0-9]+)?(?= @@)' \
    | awk -F, '{
        start=$1; count=($2==""?1:$2);
        if (count > 0) {
          for(i=start; i<start+count; i++) print i
        } else {
          lo=start-10; if (lo<1) lo=1;
          hi=start+10;
          for(i=lo;i<=hi;i++) print i
        }
      }' | sort -nu
}

scan_file() {
  local f="$1" fail=0 stripped
  [ -f "$f" ] || return 0
  [ -z "$SCOPE_LINES" ] && return 0
  # Escaneia uma cópia com COMENTÁRIOS apagados (não strings — apagar
  # string quebraria a detecção real, ver strip-ts-text.py), mesma
  # contagem de linha (blank preserva `\n`) — achado real de @codex
  # review, PR #134: texto de comentário mencionando o padrão como
  # exemplo/doc disparava os detectores igual a código de verdade.
  # `file=` nas mensagens de erro continua apontando pro arquivo REAL
  # (via REPORT_FILE), não pra cópia temporária.
  stripped=$(mktemp)
  python3 "$STRIP_TS_TEXT_PY" < "$f" > "$stripped" 2>/dev/null || cp "$f" "$stripped"
  REPORT_FILE="$f"
  check_filial_eq "$stripped" || fail=1
  check_mutations "$stripped" || fail=1
  check_status_color "$stripped" || fail=1
  rm -f "$stripped"
  return "$fail"
}

# ------------------------------------------------------------
# Self-test dos detectores (sem git diff — SCOPE_LINES = arquivo todo).
# ------------------------------------------------------------
self_test() {
  local tmp fail=0
  tmp=$(mktemp -d)

  expect_fail() {
    local name="$1" file="$2" checker="$3"
    SCOPE_LINES=$(awk '{print NR}' "$file")
    if "$checker" "$file" >"$tmp/out" 2>&1; then
      echo "FAIL expected detector to fire: $name"
      cat "$tmp/out"
      fail=1
    else
      echo "OK  (fail as expected) $name"
    fi
  }

  expect_pass() {
    local name="$1" file="$2" checker="$3"
    SCOPE_LINES=$(awk '{print NR}' "$file")
    if "$checker" "$file" >"$tmp/out" 2>&1; then
      echo "OK  (pass as expected) $name"
    else
      echo "FAIL expected detector to stay silent: $name"
      cat "$tmp/out"
      fail=1
    fi
  }

  # 1) .eq("filial_id") puro
  cat >"$tmp/filial-eq.ts" <<'EOF'
const q = supabase.from("x").eq("filial_id", id);
EOF
  expect_fail "filial .eq puro" "$tmp/filial-eq.ts" check_filial_eq

  # 2) .eq + .or(filial_id.is.null) no mesmo chain — AINDA é bug
  #    (PostgREST ANDa). Achado @codex na PR #134.
  cat >"$tmp/filial-and.ts" <<'EOF'
const q = supabase
  .from("x")
  .eq("filial_id", id)
  .or("filial_id.eq." + id + ",filial_id.is.null");
EOF
  expect_fail "filial .eq AND .or (ainda exclui globais)" "$tmp/filial-and.ts" check_filial_eq

  # 3) .or de outro campo não é escape
  cat >"$tmp/filial-other-or.ts" <<'EOF'
const q = supabase.from("x").eq("filial_id", id).or("data_fim.is.null,data_fim.gte.now");
EOF
  expect_fail "filial .eq perto de .or(data_fim.is.null)" "$tmp/filial-other-or.ts" check_filial_eq

  # 4) escape explícito
  cat >"$tmp/filial-ok.ts" <<'EOF'
const q = supabase.from("x").eq("filial_id", id); // filial-global-ok — só desta filial
EOF
  expect_pass "filial escape // filial-global-ok" "$tmp/filial-ok.ts" check_filial_eq

  # 5) forma correta: .or no lugar do .eq, sem .eq nenhum
  cat >"$tmp/filial-correct.ts" <<'EOF'
const q = supabase.from("x").or(`filial_id.eq.${id},filial_id.is.null`);
EOF
  expect_pass "filial .or substitui o .eq" "$tmp/filial-correct.ts" check_filial_eq

  # 5c) texto de COMENTÁRIO mencionando o padrão como exemplo/doc não
  # pode disparar o detector — achado real de @codex review, PR #134.
  # Usa scan_file (não check_filial_eq direto) pra exercitar o pipeline
  # de strip de comentário inteiro, incluindo REPORT_FILE.
  cat >"$tmp/filial-comment.ts" <<'EOF'
// Bug antigo: .eq("filial_id", id) excluía os globais. Corrigido abaixo.
const q = supabase.from("x").or(`filial_id.eq.${id},filial_id.is.null`);
EOF
  expect_pass "comentário citando .eq(\"filial_id\"...) como exemplo não dispara" "$tmp/filial-comment.ts" scan_file

  # 5d) sanity check: scan_file ainda pega o padrão de VERDADE (prova
  # que o strip de comentário não também apaga código real).
  cat >"$tmp/filial-real-via-scan.ts" <<'EOF'
const q = supabase.from("x").eq("filial_id", id);
EOF
  expect_fail "scan_file ainda detecta .eq(\"filial_id\"...) real" "$tmp/filial-real-via-scan.ts" scan_file

  # 5b) escape de UMA call não pode vazar pra outra .eq("filial_id")
  #     vizinha sem escape próprio (achado real de @codex review, PR #134).
  cat >"$tmp/filial-leak.ts" <<'EOF'
const a = supabase.from("x").eq("filial_id", id1); // filial-global-ok — só desta filial
const b = supabase.from("y").eq("filial_id", id2);
EOF
  expect_fail "escape de uma call não protege a vizinha" "$tmp/filial-leak.ts" check_filial_eq

  # 6) delete sem count
  cat >"$tmp/del-bare.ts" <<'EOF'
await supabase.from("fornecedores").delete().eq("id", id);
EOF
  expect_fail "delete() sem count" "$tmp/del-bare.ts" check_mutations

  # 7) delete com count nesta call
  cat >"$tmp/del-ok.ts" <<'EOF'
const { error, count } = await supabase.from("fornecedores").delete({ count: "exact" }).eq("id", id);
EOF
  expect_pass "delete({ count: exact }) nesta call" "$tmp/del-ok.ts" check_mutations

  # 8) duas mutations: só a primeira tem count — a segunda tem que falhar
  #    (achado @codex: janela de 12 linhas deixava a irmã passar).
  cat >"$tmp/del-sibling.ts" <<'EOF'
await supabase.from("a").delete({ count: "exact" }).eq("id", a);
await supabase.from("b").delete().eq("id", b);
EOF
  expect_fail "segunda mutation sem count, irmã protegida" "$tmp/del-sibling.ts" check_mutations

  # 8b) 2 mutations NA MESMA linha, só a segunda tem count — a primeira
  #     tem que falhar (achado real de @codex review, PR #134: `grep -n`
  #     reporta a linha 1x mesmo com 2 matches; sem iterar por match, só
  #     a última call era validada).
  cat >"$tmp/del-same-line.ts" <<'EOF'
Promise.all([supabase.from("a").delete().eq("id", a), supabase.from("b").delete({ count: "exact" }).eq("id", b)]);
EOF
  expect_fail "2 mutations na mesma linha, só a 2ª protegida" "$tmp/del-same-line.ts" check_mutations

  # 9) select count:exact NÃO protege delete() na linha seguinte
  cat >"$tmp/del-select-count.ts" <<'EOF'
await supabase.from("a").select("id", { count: "exact", head: true });
await supabase.from("a").delete().eq("id", id);
EOF
  expect_fail "select count:exact não protege delete()" "$tmp/del-select-count.ts" check_mutations

  # 10) Array.from + Set.delete não é mutation Supabase
  cat >"$tmp/set-delete.ts" <<'EOF'
const ids = Array.from(selectedChildren);
newSelected.delete(childId);
EOF
  expect_pass "Set.delete / Array.from não é supabase" "$tmp/set-delete.ts" check_mutations

  # 10b) Set.delete DEPOIS de uma call supabase real (statement completo,
  #      terminado em `;`) não pode ser classificado como mutation
  #      Supabase só por estar na mesma janela (achado real de @codex
  #      review, PR #134).
  cat >"$tmp/set-delete-near-supabase.ts" <<'EOF'
await supabase.from("items").select();
const selectedIds = new Set([1, 2, 3]);
selectedIds.delete(id);
EOF
  expect_pass "Set.delete perto de supabase.select() não é mutation" "$tmp/set-delete-near-supabase.ts" check_mutations

  # 10c) mesma coisa, mas os 2 statements na MESMA LINHA física,
  # separados por `;` (achado real de @codex review, PR #134: checar a
  # linha inteira, não o segmento até o match, deixava o 1º
  # supabase.from( vazar contexto pro Set.delete depois do `;`).
  cat >"$tmp/set-delete-same-line.ts" <<'EOF'
await supabase.from("items").select(); selectedIds.delete(id);
EOF
  expect_pass "Set.delete na MESMA linha de um supabase.select() não é mutation" "$tmp/set-delete-same-line.ts" check_mutations

  # 11) chain multi-linha .from + .delete()
  cat >"$tmp/del-multiline.ts" <<'EOF'
await supabase
  .from("fornecedores")
  .delete()
  .eq("id", id);
EOF
  expect_fail "delete() multi-linha sem count" "$tmp/del-multiline.ts" check_mutations

  # 12) update multi-linha com count no 2º arg
  cat >"$tmp/upd-ok.ts" <<'EOF'
await supabase
  .from("x")
  .update({ status: "ok" }, { count: "exact" })
  .eq("id", id);
EOF
  expect_pass "update(..., { count: exact })" "$tmp/upd-ok.ts" check_mutations

  # 13) escape count-exact-ok
  cat >"$tmp/del-escape.ts" <<'EOF'
await supabase.from("x").delete().eq("id", id); // count-exact-ok — PK única
EOF
  expect_pass "delete escape // count-exact-ok" "$tmp/del-escape.ts" check_mutations

  # 13b) escape de UMA call não pode vazar pra outra .delete()/.update()
  #      vizinha sem escape próprio (achado real de @codex review, PR #134).
  cat >"$tmp/del-leak.ts" <<'EOF'
await supabase.from("a").delete().eq("id", ida); // count-exact-ok — PK única
await supabase.from("b").delete().eq("id", idb);
EOF
  expect_fail "escape de uma call não protege a vizinha" "$tmp/del-leak.ts" check_mutations

  # 14) STATUS_COLOR como tinta
  cat >"$tmp/color.ts" <<'EOF'
const style = { color: STATUS_COLOR.warning };
EOF
  expect_fail "color: STATUS_COLOR" "$tmp/color.ts" check_status_color

  # 15) STATUS_COLOR como fundo (não bate no regex color:)
  cat >"$tmp/bg.ts" <<'EOF'
const style = { backgroundColor: STATUS_COLOR.warning };
EOF
  expect_pass "backgroundColor: STATUS_COLOR" "$tmp/bg.ts" check_status_color

  if [ "$fail" -eq 1 ]; then
    echo ""
    echo "Self-test FALHOU."
    rm -rf "$tmp"
    return 1
  fi
  echo ""
  echo "Self-test OK (22 casos)."
  rm -rf "$tmp"
  return 0
}

scan_pr() {
  local base_sha="${BASE_SHA:-}"
  local fail=0
  local f

  if [ -z "$base_sha" ]; then
    echo "::error::BASE_SHA não definido."
    return 1
  fi

  local changed
  # `src/**/*.tsx` NÃO casa arquivo direto em src/ (ex.: src/App.tsx,
  # src/main.tsx) — `**` no pathspec do git exige pelo menos 1 nível de
  # diretório abaixo (achado real de /code-review ultra local, PR #134,
  # confirmado: `git ls-files 'src/**/*.tsx'` omite src/App.tsx, `git
  # ls-files 'src/*.tsx'` inclui). Pathspec de topo + `**` cobre os 2
  # níveis sem duplicar arquivo (git diff dedupa automaticamente).
  changed=$(git diff --name-only "$base_sha"...HEAD -- \
    'src/*.ts' 'src/*.tsx' 'src/**/*.ts' 'src/**/*.tsx' \
    'supabase/functions/*.ts' 'supabase/functions/**/*.ts' || true)

  if [ -z "$changed" ]; then
    echo "Nenhum arquivo relevante mudou."
    return 0
  fi

  echo "Arquivos em checagem:"
  echo "$changed"
  echo ""

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    SCOPE_LINES=$(scope_lines_for_file "$f" "$base_sha")
    if [ -z "$SCOPE_LINES" ]; then
      continue
    fi
    scan_file "$f" || fail=1
  done <<< "$changed"

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    check_chart_hex_warning "$f"
  done <<< "$changed"

  if [ "$fail" -eq 1 ]; then
    echo ""
    echo "::error::Padrões de bug conhecido encontrados (nas linhas adicionadas por esta PR, ou numa margem de hunk só-de-remoção). Corrija ou adicione o comentário de escape explícito se for falso positivo."
    return 1
  fi

  echo "Nenhum padrão de bug conhecido encontrado nas linhas adicionadas."
  return 0
}

if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit $?
fi

scan_pr
exit $?
