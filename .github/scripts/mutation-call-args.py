#!/usr/bin/env python3
"""Extract the argument text of `.delete(` / `.update(` on a given line.

Used by pattern-guardrails.sh so `count: "exact"` is checked on THIS call,
not on a sibling a few lines away. A separate file (not a heredoc) so the
parser does not steal stdin from the caller's `while read` loop.
"""
from __future__ import annotations

import re
import sys


def mutation_call_args(path: str, lineno: int, match_index: int = -1) -> str:
    """match_index: 1-based position of the `.delete(`/`.update(` call on
    the line (left to right); -1 (default) keeps the old last-match
    behavior for callers that don't care. Needed because `grep -n` reports
    a matching LINE once even when it has 2+ calls (e.g.
    `Promise.all([a.delete(), b.delete({count:"exact"})])`) — a caller
    that only invokes this once per line silently validates just the last
    call, leaving earlier ones unchecked (achado real de `@codex review`,
    PR #134).
    """
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    if lineno < 1 or lineno > len(lines):
        raise SystemExit(2)
    line = lines[lineno - 1]
    matches = list(re.finditer(r"\.(?:delete|update)\s*\(", line))
    if not matches:
        raise SystemExit(3)
    try:
        match = matches[match_index - 1] if match_index != -1 else matches[-1]
    except IndexError:
        raise SystemExit(3)
    start_col = match.end() - 1  # the '('
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
    if len(sys.argv) not in (3, 4):
        raise SystemExit(64)
    match_index = int(sys.argv[3]) if len(sys.argv) == 4 else -1
    sys.stdout.write(mutation_call_args(sys.argv[1], int(sys.argv[2]), match_index))


if __name__ == "__main__":
    main()
