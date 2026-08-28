#!/usr/bin/env python3
"""Blanks out TS/TSX COMMENT content (`//` and `/* */`), keeping
line/column positions stable (newlines preserved, everything else in a
stripped span replaced by a space) so the pattern-guardrails.sh detectors
don't fire on text that only appears inside a comment (achado real de
@codex review, PR #134).

Does NOT strip string literals: a string like
`.eq("filial_id", id)` is exactly what a REAL `.eq("filial_id", ...)`
call looks like once quoted — stripping all strings would blind the
detectors to the actual bug patterns they exist to catch (verified:
blanking `"filial_id"` inside a genuine `.eq("filial_id", id)` call
breaks the check_filial_eq detector on real code, not just
documentation). A string used purely as documentation/example text
(`const note = '.eq("filial_id", id) must include globals';`) can still
false-positive after this — that's a known, accepted limitation of a
grep-speed tool (see pattern-guardrails.sh's own header on scope); use
the existing `// filial-global-ok` / `// count-exact-ok` escape comments
if that happens, same as for a real intentional case.

Skips string/template content while scanning ONLY to avoid stopping
comment detection at a `//`/`/*` that's actually inside a string (e.g.
a URL like `"https://example.com"`), not to blank the string itself.
"""
from __future__ import annotations

import sys


def _blank(seg: str) -> str:
    return "".join(ch if ch == "\n" else " " for ch in seg)


def strip_comments(s: str) -> str:
    out: list[str] = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        two = s[i : i + 2]

        if two == "//":
            j = s.find("\n", i)
            end = j if j != -1 else n
            out.append(_blank(s[i:end]))
            i = end
            continue

        if two == "/*":
            j = s.find("*/", i + 2)
            end = j + 2 if j != -1 else n
            out.append(_blank(s[i:end]))
            i = end
            continue

        if c in ("'", '"', "`"):
            # Passa pelo conteúdo da string/template SEM apagar — só pra
            # não confundir um `//`/`/*` DENTRO da string (ex.: uma URL
            # "https://x.com") com um comentário de verdade.
            q = c
            out.append(c)
            j = i + 1
            while j < n:
                if s[j] == "\\" and j + 1 < n:
                    out.append(s[j : j + 2])
                    j += 2
                    continue
                if s[j] == q:
                    out.append(s[j])
                    j += 1
                    break
                out.append(s[j])
                j += 1
            i = j
            continue

        out.append(c)
        i += 1

    return "".join(out)


def main() -> None:
    sys.stdout.write(strip_comments(sys.stdin.read()))


if __name__ == "__main__":
    main()
