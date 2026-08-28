#!/usr/bin/env python3
"""Decide se o match idx (1-based) de .delete(/.update( na linha tem um
escape `count-exact-ok` que pertence A ELE, não a uma call vizinha na
MESMA linha física.

Por que isto existe (achado real de @codex review, PR #134): um `//`
comment em JS/TS sempre vai até o fim da linha física — então numa linha
com 2+ calls (ex.: `Promise.all([a.delete(), b.delete()]); // count-exact-ok`)
é fisicamente impossível um `// count-exact-ok` no FIM da linha dizer
respeito só a uma das calls; ele só pode, sem ambiguidade, exemptar a
ÚLTIMA call da linha. Checar a linha inteira (achado anterior, já
corrigido) fazia esse comentário exemptar TODAS as calls, inclusive uma
1ª call desguarnecida sem relação nenhuma com o comentário.

Regra aplicada:
  - `/* count-exact-ok */` (block comment) É posicionável entre 2 calls
    na mesma linha — conta como escape SÓ se aparecer no trecho entre o
    início desta call e o início da PRÓXIMA call (ou fim da linha, se
    for a última).
  - `// count-exact-ok` (comentário de linha) só pode, sem ambiguidade,
    pertencer à ÚLTIMA call da linha — só conta como escape pra ela.

Exit 0 = escapado (não reportar esta call). Exit 1 = não escapado.
"""
from __future__ import annotations

import re
import sys


def main() -> int:
    if len(sys.argv) != 4:
        print("uso: mutation-escape-scope.py <linha> <idx> <nmatches>", file=sys.stderr)
        return 2
    line, idx, nmatches = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])

    positions = [m.start() for m in re.finditer(r"\.(delete|update)\(", line)]
    if idx < 1 or idx > len(positions):
        return 1

    start = positions[idx - 1]
    end = positions[idx] if idx < len(positions) else len(line)
    scope = line[start:end]

    if "/* count-exact-ok */" in scope:
        return 0
    if idx == nmatches and "// count-exact-ok" in scope:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
