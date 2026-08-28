#!/usr/bin/env python3
"""Extract the argument text of `.delete(` / `.update(` on a given line.

Used by pattern-guardrails.sh so `count: "exact"` is checked on THIS call,
not on a sibling a few lines away. A separate file (not a heredoc) so the
parser does not steal stdin from the caller's `while read` loop.
"""
from __future__ import annotations

import re
import sys


def mutation_call_args(path: str, lineno: int) -> str:
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    if lineno < 1 or lineno > len(lines):
        raise SystemExit(2)
    line = lines[lineno - 1]
    matches = list(re.finditer(r"\.(?:delete|update)\s*\(", line))
    if not matches:
        raise SystemExit(3)
    start_col = matches[-1].end() - 1  # the '('
    rest = line[start_col:] + "".join(lines[lineno:])
    depth = 0
    in_str = None
    escape = False
    i = 0
    while i < len(rest):
        c = rest[i]
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == in_str:
                in_str = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            in_str = c
            i += 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return rest[1:i]
        i += 1
    return rest[1:]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(64)
    sys.stdout.write(mutation_call_args(sys.argv[1], int(sys.argv[2])))


if __name__ == "__main__":
    main()
