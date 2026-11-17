#!/usr/bin/env bash
# Cut a release and AUTO-BUMP the shared loader version so parallel Claude
# sessions never collide on the number.
#
# Usage: scripts/release.sh <tool-id>
#   Run it AFTER you have edited tools/<tool-id>.js (and bumped that file's own
#   "Version:" header) and repointed loader.js's TOOLS ref for that tool to the
#   new tool tag. This script then:
#     - reads the tool's version  -> tool tag  <tool-id>-v<ver>
#     - derives the next loader version from the REMOTE v0.1.* tags (not from a
#       hardcoded guess), writes it into loader.js's header -> loader tag v0.1.N
#     - commits the staged change, tags both, and pushes atomically.
#   Deriving the number from the remote at the last moment is what makes it safe
#   across sessions: whoever pushes first wins; a loser just re-runs and gets the
#   next free number.
#
# shortcut: only bumps loader.js's header (not loader-stage-designer.js); upgrade
# if the stage-only loader starts being released on this shared counter too.
set -euo pipefail
cd "$(dirname "$0")/.."

# --- self-check: numeric (not lexical) max of v0.1.N tags -------------------
if [ "${1:-}" = "--selftest" ]; then
  got=$(printf 'v0.1.9\nv0.1.129\nv0.1.12\nvbad\nv0.1.130\n' \
        | sed -n 's/^v0\.1\.\([0-9]\{1,\}\)$/\1/p' | sort -n | tail -1)
  [ "$got" = "130" ] || { echo "selftest FAIL: got '$got', expected 130" >&2; exit 1; }
  echo "selftest OK"; exit 0
fi

tool="${1:?usage: scripts/release.sh <tool-id>}"
toolfile="tools/$tool.js"
[ -f "$toolfile" ] || { echo "no such tool file: $toolfile" >&2; exit 1; }

toolver=$(sed -n 's/^ \* Version: \(.*\)$/\1/p' "$toolfile" | head -1)
[ -n "$toolver" ] || { echo "no 'Version:' header in $toolfile" >&2; exit 1; }
tooltag="$tool-v$toolver"

git fetch --tags --quiet origin
git rev-parse -q --verify "refs/tags/$tooltag" >/dev/null \
  && { echo "tag $tooltag already exists — bump $toolfile's Version header first" >&2; exit 1; }

# next shared loader version = (numeric) max existing v0.1.N + 1
n=$(git tag -l 'v0.1.*' | sed -n 's/^v0\.1\.\([0-9]\{1,\}\)$/\1/p' | sort -n | tail -1)
[ -n "$n" ] || { echo "found no v0.1.* loader tags" >&2; exit 1; }
next="0.1.$((n + 1))"
loadertag="v$next"

sed -i "s/^ \* Version: .*/ * Version: $next/" loader.js

git add -A
git commit -q -m "$tool v$toolver + loader v$next" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git tag "$tooltag"
git tag "$loadertag"

if git push --atomic --quiet origin HEAD "$tooltag" "$loadertag"; then
  echo "released $tooltag + loader $loadertag"
  echo "point HireHop's plugin URL at @$loadertag to go live."
  exit 0
fi

# Lost the race: another session pushed first. Roll our commit/tags back but
# KEEP the file edits staged, then tell the caller to re-run (recomputes N).
git tag -d "$tooltag" "$loadertag" >/dev/null
git reset --soft HEAD~1
echo "push rejected — another session released meanwhile." >&2
echo "run:  git pull --ff-only origin $(git branch --show-current)  &&  scripts/release.sh $tool" >&2
exit 1
