#!/usr/bin/env bash
set -e

ROOT="${CLAUDE_PROJECT_DIR:-${CURSOR_PROJECT_DIR:-.}}"
cd "$ROOT"

echo "[verify-on-edit] running compile check" >&2

# Run compile and capture output
if ! COMPILE_OUTPUT=$(npm run compile 2>&1); then
  # Compile failed - truncate and escape for JSON
  ERROR_MSG=$(echo "$COMPILE_OUTPUT" | head -c 500 | tr -d '\000-\037\177' | sed 's/\\/\\\\/g; s/"/\\"/g')
  echo "[verify-on-edit] compile failed" >&2
  echo "{\"followup_message\": \"Compile failed after edit. Fix the errors:\\n$ERROR_MSG\"}"
  exit 0
fi

echo "[verify-on-edit] compile passed" >&2
exit 0
