#!/usr/bin/env bash
# PostToolUse / afterFileEdit hook: mark that an edit occurred in this session.
# Consume stdin (JSON input from hook system)
cat > /dev/null

ROOT=$(git rev-parse --show-toplevel)
MARKER="$ROOT/.claude/.edit-marker"
touch "$MARKER"
exit 0
