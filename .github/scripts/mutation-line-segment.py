#!/usr/bin/env python3
"""Isola o trecho da linha até (e incluindo) o match `idx` (1-based) de
.delete(/.update(, cortando em `;` — mas só em `;` que está em código de
verdade, não dentro de uma string/template literal.

Por que existe (achado real de @codex review xhigh, PR #134): a versão
anterior desta lógica (bash puro, `IFS=';' read -ra segs`) cortava em
QUALQUER `;` literal na linha, inclusive um `;` dentro do TEXTO de um
argumento de string — ex.: `.from("obs; nota").update({...})`. Isso
separava o `.from(` do seu próprio `.update(` na mesma chain, fazendo
`mutation_belongs_to_chain` andar pra trás procurando contexto Supabase
numa linha física ANTERIOR (que não existe), e o check `count: "exact"`
saía sem rodar pra essa call — bypass silencioso do achado da PR #126
que este detector existe pra fechar.

Reaproveita a mesma lógica de scan de aspas/template literal de
find-code-matches.py (que a linha do Set.delete detecta é aqui
duplicada, deliberadamente pequena e sem a complexidade de comentário —
esta função só precisa saber "estou dentro de uma string?", não
"isto é código real vs. comentário").
"""
from __future__ import annotations

import re
import sys


def _split_top_level_semicolons(line: str) -> list[str]:
    segs: list[str] = []
    buf: list[str] = []
    i, n = 0, len(line)
    quote: str | None = None
    while i < n:
        c = line[i]
        if quote:
            buf.append(c)
            if c == "\\" and i + 1 < n:
                buf.append(line[i + 1])
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            quote = c
            buf.append(c)
            i += 1
            continue
        if c == ";":
            segs.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    segs.append("".join(buf))
    return segs


def line_segment(line: str, idx: int) -> str:
    segs = _split_top_level_semicolons(line)
    running = 0
    mutation_re = re.compile(r"\.(delete|update)\(")
    for seg in segs:
        n_in_seg = len(mutation_re.findall(seg))
        if running + n_in_seg >= idx:
            return seg
        running += n_in_seg
    return line


def main() -> None:
    if len(sys.argv) != 3:
        print("uso: mutation-line-segment.py <linha> <idx>", file=sys.stderr)
        raise SystemExit(2)
    sys.stdout.write(line_segment(sys.argv[1], int(sys.argv[2])))


if __name__ == "__main__":
    main()
