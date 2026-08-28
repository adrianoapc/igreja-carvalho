#!/usr/bin/env python3
"""Emit grep-n-like matches whose start sits in CODE, not in a string or
comment.

Used by pattern-guardrails.sh so a documentation string like
`const note = '.eq("filial_id", id) must include globals'` does not trip
the filial/mutation/STATUS_COLOR detectors, while a real call
`.eq("filial_id", id)` still does — the match starts at `.eq`, which is
code; only the argument is a string (achado real de @codex review, PR
#134).

Prints `lineno:index` (1-based index among ALL matches of the pattern on
that line, including ones inside strings — callers skip missing indices).
"""
from __future__ import annotations

import re
import sys


def code_mask(s: str) -> list[bool]:
    n = len(s)
    mask = [True] * n
    i = 0

    def skip_string(q: str, start: int) -> int:
        """Blank string contents (keep quotes as code). Handle ${} in
        templates by resuming a nested code scan until the matching }."""
        j = start + 1
        while j < n:
            if s[j] == "\\" and j + 1 < n:
                mask[j] = False
                mask[j + 1] = False
                j += 2
                continue
            if q == "`" and s[j : j + 2] == "${":
                mask[j] = False
                mask[j + 1] = False
                j += 2
                j = scan_code(j, until_brace=True)
                continue
            if s[j] == q:
                return j + 1
            mask[j] = False
            j += 1
        return j

    def scan_code(j: int, until_brace: bool = False) -> int:
        depth = 1 if until_brace else 0
        while j < n:
            two = s[j : j + 2]
            if two == "//":
                end = s.find("\n", j)
                end = end if end != -1 else n
                for k in range(j, end):
                    mask[k] = False
                j = end
                continue
            if two == "/*":
                end = s.find("*/", j + 2)
                end = end + 2 if end != -1 else n
                for k in range(j, end):
                    mask[k] = False
                j = end
                continue
            if s[j] in ("'", '"', "`"):
                j = skip_string(s[j], j)
                continue
            if until_brace:
                if s[j] == "{":
                    depth += 1
                elif s[j] == "}":
                    depth -= 1
                    if depth == 0:
                        return j + 1
            j += 1
        return j

    scan_code(0, until_brace=False)
    return mask


def find_code_matches(s: str, pattern: str) -> list[tuple[int, int]]:
    """Return (lineno, 1-based-index-on-line) for matches in code."""
    mask = code_mask(s)
    rx = re.compile(pattern)
    out: list[tuple[int, int]] = []
    pos = 0
    for lineno, line in enumerate(s.splitlines(keepends=True), 1):
        idx = 0
        for m in rx.finditer(line):
            idx += 1
            abs_pos = pos + m.start()
            if abs_pos < len(mask) and mask[abs_pos]:
                out.append((lineno, idx))
        pos += len(line)
    return out


def main() -> int:
    if len(sys.argv) != 3:
        print("uso: find-code-matches.py <regex> <arquivo>", file=sys.stderr)
        return 2
    pattern, path = sys.argv[1], sys.argv[2]
    with open(path, encoding="utf-8") as f:
        s = f.read()
    for lineno, idx in find_code_matches(s, pattern):
        print(f"{lineno}:{idx}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
