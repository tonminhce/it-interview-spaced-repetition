#!/usr/bin/env bash
# Render each view in headless Chrome and assert on the resulting DOM.
#
# Catches the class of bug that is invisible in code review: an operator
# precedence slip in a string concatenation silently dropping half a
# template, which leaves a plausible-looking page missing its hero section.
#
# Usage: bash tools/verify-views.sh

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="file:///$(cygpath -m "$ROOT")/index.html"
TMP="$(mktemp -d)"

fail=0

# check <name> <hash> <required-marker> [<required-marker> ...]
check() {
  local name="$1" hash="$2"
  shift 2
  local markers=("$@")
  local out="$TMP/$name.html"

  "$CHROME" --headless=new --disable-gpu --dump-dom --virtual-time-budget=6000 \
    "$BASE$hash" > "$out" 2>/dev/null

  local problems=""

  # A leaked NaN or undefined anywhere in the rendered markup.
  if grep -q 'NaN' "$out"; then
    problems="$problems NaN-leaked"
  fi
  if grep -qE '\[[Oo]bject [Oo]bject\]' "$out"; then
    problems="$problems object-object"
  fi
  if grep -qE '>undefined<' "$out"; then
    problems="$problems undefined-leaked"
  fi

  # Required structural markers.
  local marker
  for marker in "${markers[@]}"; do
    if ! grep -q "$marker" "$out"; then
      problems="$problems missing:$marker"
    fi
  done

  local bytes
  bytes=$(wc -c < "$out")

  if [ -n "$problems" ]; then
    echo "FAIL  $name ($bytes bytes):$problems"
    fail=1
  else
    echo "ok    $name ($bytes bytes)"
  fi
}

check "home"        "#/home" \
  'class="hero-grid"' 'class="hero-card hero-card--goal"' 'class="stat-card stat-card--ring"' \
  'class="ring__fill"' 'class="ring__label"' 'class="topic-grid"' 'class="activity__bar"'

check "study-all"   "#/study/all" \
  'class="flashcard"' 'class="flashcard__qbar"' 'id="answer-region"' 'class="reveal__inner"' \
  'id="reveal-trigger"' 'class="rating-dock"'

check "study-redis" "#/study/redis" \
  'class="flashcard"' 'id="card-question"' 'class="prose"'

check "study-java"  "#/study/java" \
  'class="flashcard"' 'id="card-answer"'

check "browse-all"  "#/browse/all" \
  'class="q-list"' 'class="q-row"' 'id="browse-search"'

check "browse-java" "#/browse/java" \
  'class="q-list"' 'class="q-row"'

rm -rf "$TMP"

if [ $fail -eq 0 ]; then
  echo "All views render as expected."
fi
exit $fail
