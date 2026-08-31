#!/usr/bin/env python3
"""Blanks out the LITERAL, non-executable content of a bash command
string, keeping only the real command structure (flags, `-C`, operators)
so pre-commit-checks.sh's detection regexes never fire on commit-message
text pretending to be a real `git commit`/`-C`/flag.

Moved to its own file (round 11 of this exact bug class within PR #134)
because hand-escaping this Python source to embed it inside a bash
single-quoted `python3 -c '...'` heredoc was itself the proximate cause
of several earlier self-inflicted bugs in this session — a normal .py
file has no quote-escaping to get wrong.

Handles, recursively:
  - single-quoted strings ('...'): 100% literal, blanked entirely.
  - double-quoted strings ("..."): backslash-escapes are literal; a
    nested `$(...)` is LIVE bash and is recursed into (not blanked) —
    achado real (@codex review xhigh, PR #134): a `git commit` hidden
    inside `$(...)` inside double quotes actually executes, but the
    previous version blanked the whole double-quoted span including
    the substitution, so the hidden commit bypassed the hook entirely.
  - `$(...)` command substitution: always live code, recursed into
    with its own quote/heredoc scanning, wherever it appears (top
    level, inside double quotes, inside an unquoted heredoc body).
  - heredocs (<<DELIM, <<'DELIM', <<"DELIM", <<BACKSLASH-DELIM, with
    optional <<-): achado real (@codex review xhigh, PR #134) — the
    previous version only recognized a quote-wrapped delimiter
    (optional quote char before the delimiter), missing the equally
    valid backslash-escaped delimiter form,
    which left that heredoc's body completely unstripped. A QUOTED or
    backslash-escaped delimiter means the body is 100% literal (no
    expansion at all in real bash) — blanked entirely. An UNQUOTED
    delimiter means the body allows `$(...)` expansion in real bash,
    so it's recursively scanned the same as command-level text (this
    is also what makes this project's own mandated commit idiom,
    `git commit -m "$(cat <<'EOF' ... EOF)"`, work correctly: 'EOF' is
    quoted, so the actual commit message body stays inert).
"""
from __future__ import annotations

import re
import sys

HEREDOC_RE = re.compile(
    r"<<-?\s*(?:'([A-Za-z_][A-Za-z0-9_]*)'"
    r"|\"([A-Za-z_][A-Za-z0-9_]*)\""
    r"|\\([A-Za-z_][A-Za-z0-9_]*)"
    r"|([A-Za-z_][A-Za-z0-9_]*))"
)


# Blanqueamento produz string VAZIA (não espaços) — achado real desta
# rodada: preservar posição com espaços fazia um valor -C/cd citado
# virar uma string de espaços NÃO-vazia depois do blanqueamento, e o
# resto do arquivo testa `[ -z "$C_VAL" ]` pra decidir se recupera o
# valor de verdade do $CMD original — string de espaços não é "-z",
# então a recuperação nunca disparava e os espaços viravam, eles
# mesmos, um path relativo bizarro. Nada neste arquivo faz match por
# linha (só grep -qE/[[ =~ ]] na string inteira), então preservar
# posição/newline não tem valor real aqui.


def _find_heredoc_end(s: str, body_start: int, delim: str) -> int:
    end_re = re.compile(r"(?m)^[ \t]*" + re.escape(delim) + r"[ \t]*$")
    m = end_re.search(s, body_start)
    return m.end() if m else len(s)


def _scan_dquote(s: str, i: int, n: int) -> tuple[str, int]:
    # Dentro de aspas duplas: \\ escapa (2 chars, blanqueados — são
    # texto literal de mensagem, não estrutura), ' é literal (não
    # fecha nada, vira texto blanqueado igual ao resto), $(...) é
    # live (recursa via _scan_command, preservado), " fecha a string.
    # Todo o resto é texto literal de mensagem — blanqueado (achado
    # real desta rodada: a versão anterior desta função só reconhecia
    # \\/$(/", nunca blanqueava caractere nenhum, então "-C .../
    # texto de mensagem passava intacto pro output).
    out: list[str] = []
    while i < n:
        c = s[i]
        if c == '"':
            out.append(c)
            return "".join(out), i + 1
        if c == "\\" and i + 1 < n:
            i += 2
            continue
        if c == "$" and i + 1 < n and s[i + 1] == "(":
            inner, new_i = _scan_command(s, i + 2, n, stop_at_paren=True)
            out.append("$(" + inner)
            i = new_i
            continue
        i += 1
    return "".join(out), i


def _scan_command(s: str, i: int, n: int, stop_at_paren: bool) -> tuple[str, int]:
    # Scanner de "nível de comando" — usado no top-level, dentro de
    # $(...), e dentro do corpo de heredoc NÃO citado (onde $(...)
    # expande de verdade). Reconhece aspas simples/duplas, heredoc, e
    # $(...) aninhado. Se stop_at_paren, para e retorna no `)` que
    # fecha o `(` já aberto (usado por $(...)).
    out: list[str] = []
    depth = 1
    while i < n:
        c = s[i]
        if stop_at_paren:
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    out.append(c)
                    return "".join(out), i + 1
        if c == "\\" and i + 1 < n:
            out.append(s[i : i + 2])
            i += 2
            continue
        if c == "'":
            j = i + 1
            while j < n and s[j] != "'":
                j += 1
            j += 1
            out.append("''")
            i = j
            continue
        if c == '"':
            inner, new_i = _scan_dquote(s, i + 1, n)
            out.append('"' + inner)
            i = new_i
            continue
        if s[i : i + 2] == "<<":
            m = HEREDOC_RE.match(s, i)
            if m:
                delim = m.group(1) or m.group(2) or m.group(3) or m.group(4)
                quoted = bool(m.group(1) or m.group(2) or m.group(3))
                marker_end = m.end()
                nl = s.find("\n", marker_end)
                body_start = nl + 1 if nl != -1 else n
                body_end = _find_heredoc_end(s, body_start, delim)
                out.append(s[i:body_start])
                body = s[body_start:body_end]
                if quoted:
                    pass  # 100% literal — omitido do output, não substituído por nada
                else:
                    body_out, _ = _scan_command(body, 0, len(body), stop_at_paren=False)
                    out.append(body_out)
                i = body_end
                continue
        if c == "$" and i + 1 < n and s[i + 1] == "(":
            inner, new_i = _scan_command(s, i + 2, n, stop_at_paren=True)
            out.append("$(" + inner)
            i = new_i
            continue
        out.append(c)
        i += 1
    return "".join(out), i


def strip_command(s: str) -> str:
    out, _ = _scan_command(s, 0, len(s), stop_at_paren=False)
    return out


def main() -> None:
    sys.stdout.write(strip_command(sys.stdin.read()))


if __name__ == "__main__":
    main()
