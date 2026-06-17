#!/usr/bin/env bash
# Stop hook: run compile, lint, effect LS (uncommitted .ts only), test, vscode:bundle.
# On first failure, block with reason for agent to fix. Wireit cache hits = success.
# stderr → Hooks output channel
set -e

# Read stdin to check stop_hook_active
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then
  echo "[verify-stop] stop_hook_active=true, allowing stop" >&2
  exit 0
fi

ROOT="${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-.}}"
cd "$ROOT"
echo "[verify-stop] starting" >&2

fail() {
  local step="$1"
  local out="$2"
  # Strip control chars (incl. ANSI codes) so JSON stays valid; escape \ " for JSON
  local err
  err=$(printf '%s' "$out" | head -c 500 | tr -d '\000-\037\177' | tr '\n' ' ' | sed 's/\\/\\\\/g; s/"/\\"/g')
  echo "[verify-stop] failed: $step" >&2
  echo "{\"decision\": \"block\", \"reason\": \"Verification failed: $step — $err. Fix the errors and try again.\"}"
  exit 0
}

run_step() {
  local step="$1"
  local cmd="$2"
  local out
  out=$(eval "$cmd" 2>&1) || fail "$step" "$out"
}

# Check if this agent session made any changes.
# mark-edit.sh (.claude/hooks) touches this file via PostToolUse on every Edit/Write.
SESSION_MARKER="$ROOT/.claude/.edit-marker"

if [ ! -f "$SESSION_MARKER" ]; then
  echo "[verify-stop] no edits in this session, skipping verification" >&2
  exit 0
fi

echo "[verify-stop] edits detected in session, running verification" >&2
# Clean up marker for next run
rm -f "$SESSION_MARKER"

run_step "compile" "npm run compile" && echo "[verify-stop] compile ok" >&2
run_step "lint" "npm run lint" && echo "[verify-stop] lint ok" >&2

# Effect LS: only uncommitted .ts files.
# Invoke the locally-installed bin directly (never bare `npx`, which would
# silently fetch+execute an unscoped registry typosquat if the local install
# is missing). The package is a top-level devDep in package.json.
EFFECT_LS="$ROOT/node_modules/.bin/effect-language-service"
ts_files=$(git diff --name-only HEAD 2>/dev/null | grep '\.ts$' || true)
if [ -n "$ts_files" ]; then
  [ -x "$EFFECT_LS" ] || fail "effect LS" "$EFFECT_LS not found — run npm install"
  for f in $ts_files; do
    [ -f "$f" ] && run_step "effect LS ($f)" "\"$EFFECT_LS\" diagnostics --file $f"
  done
fi
[ -z "$ts_files" ] && echo "[verify-stop] effect LS skipped (no uncommitted .ts)" >&2

run_step "test" "npm run test" && echo "[verify-stop] test ok" >&2
run_step "vscode:bundle" "npm run vscode:bundle" && echo "[verify-stop] vscode:bundle ok" >&2
run_step "knip" "npm run check:knip" && echo "[verify-stop] knip ok" >&2
echo "[verify-stop] all passed" >&2
