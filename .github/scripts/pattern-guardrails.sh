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

# Extrai o texto entre o `(` do `.delete(` / `.update(` na linha dada e
# o `)` que fecha ESSA call (pula strings). Assim `count: "exact"` duma
# call irmã não protege outra. Script separado (não heredoc) pra não
# roubar o stdin do `while read` do detector.
mutation_call_args() {
  python3 "$MUTATION_ARGS_PY" "$1" "$2"
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
    win=$(window "$f" "$lineno" 5 2)
    if echo "$win" | grep -q '// filial-global-ok'; then
      continue
    fi
    echo "::error file=$f,line=$lineno::.eq(\"filial_id\"...) exclui filial_id IS NULL mesmo se houver .or(...) no mesmo chain (PostgREST ANDa os filtros). Substitua o .eq por .or(\"filial_id.eq.X,filial_id.is.null\"), ou // filial-global-ok se a exclusão de globais for intencional. Ver CLAUDE.md §Filial compartilhada."
    fail=1
  done < <(grep -n '\.eq(["'"'"']filial_id["'"'"']' "$f" || true)
  return "$fail"
}

is_supabase_mutation_ctx() {
  local ctx="$1"
  echo "$ctx" | grep -qE '\.from\(["'"'"']|supabase[A-Za-z]*\.'
}

check_mutations() {
  local f="$1" fail=0
  local lineno ctx_start ctx args win
  while IFS=: read -r lineno _; do
    [ -z "$lineno" ] && continue
    in_scope "$lineno" || continue
    ctx_start=$((lineno > 10 ? lineno - 10 : 1))
    ctx=$(sed -n "${ctx_start},$((lineno + 3))p" "$f")
    # .from\(["'] exige aspas logo após o parêntese — bate em
    # .from("tabela") do Supabase, não em Array.from(x) (achado real:
    # Array.from(selectedChildren) perto de Set.delete disparava).
    is_supabase_mutation_ctx "$ctx" || continue
    win=$(window "$f" "$lineno" 3 1)
    if echo "$win" | grep -q '// count-exact-ok'; then
      continue
    fi
    args=$(mutation_call_args "$f" "$lineno" 2>/dev/null || true)
    if ! printf '%s' "$args" | grep -qE 'count:[[:space:]]*["'"'"']exact["'"'"']'; then
      echo "::error file=$f,line=$lineno::.delete()/.update() do Supabase sem { count: \"exact\" } NESTA call — se o RLS negar, retorna error:null/0 linhas e o código pode reportar sucesso falso (PR #126). Adicione { count: \"exact\" } no argumento desta call (não numa irmã) e cheque o count retornado, ou // count-exact-ok se a call já é auto-limitada por PK/id único."
      fail=1
    fi
  done < <(grep -nE '\.(delete|update)\(' "$f" || true)
  return "$fail"
}

check_status_color() {
  local f="$1" fail=0
  local lineno
  while IFS=: read -r lineno _; do
    [ -z "$lineno" ] && continue
    in_scope "$lineno" || continue
    echo "::error file=$f,line=$lineno::STATUS_COLOR é cor de FUNDO de pill, não tinta de texto — usar como \`color:\` falha contraste WCAG 3:1 em card claro (PR #114). Use pillStyle(tone) de statusPalette.ts."
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
  # uma margem de 10 linhas em torno do ponto de cada hunk — cobre hunks
  # só-de-remoção (ex.: apagar só `{ count: "exact" }` de um .delete()
  # multi-linha). Padrão pré-existente fora de qualquer hunk nunca entra.
  git diff -U0 "$base_sha"...HEAD -- "$f" 2>/dev/null \
    | grep -oP '^@@ -[0-9]+(,[0-9]+)? \+\K[0-9]+(,[0-9]+)?(?= @@)' \
    | awk -F, '{
        start=$1; count=($2==""?1:$2);
        lo=start-10; if (lo<1) lo=1;
        hi=start+(count>0?count:1)+10;
        for(i=lo;i<=hi;i++) print i
      }' | sort -nu
}

scan_file() {
  local f="$1" fail=0
  [ -f "$f" ] || return 0
  [ -z "$SCOPE_LINES" ] && return 0
  check_filial_eq "$f" || fail=1
  check_mutations "$f" || fail=1
  check_status_color "$f" || fail=1
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
  echo "Self-test OK (15 casos)."
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
  changed=$(git diff --name-only "$base_sha"...HEAD -- \
    'src/**/*.ts' 'src/**/*.tsx' 'supabase/functions/**/*.ts' || true)

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
