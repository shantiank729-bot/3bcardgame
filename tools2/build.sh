#!/bin/bash
# src2/ の ぶひんを じゅんばんに つないで rpg2.html を つくる
set -e
cd "$(dirname "$0")/.."
{ cat src2/00_head.html; for f in src2/[0-9][0-9]_*.js; do echo "/* ===== $(basename $f) ===== */"; cat "$f"; done; echo "</script>"; } > rpg2.html
echo "built rpg2.html ($(wc -l < rpg2.html) lines)"
