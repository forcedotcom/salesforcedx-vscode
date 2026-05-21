#!/usr/bin/env bash

set -euo pipefail

INPUT="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  REL_PATH="${FILE_PATH#${CLAUDE_PROJECT_DIR}/}"
else
  REL_PATH="$FILE_PATH"
fi

matches_rule=false

case "$REL_PATH" in
  *.ts|*.tsx) matches_rule=true ;;
  */package.json|package.json) matches_rule=true ;;
  */esbuild.config.*|esbuild.config.*) matches_rule=true ;;
  scripts/*) matches_rule=true ;;
  */.vscodeignore|.vscodeignore) matches_rule=true ;;
  */.vscode/*|.vscode/*) matches_rule=true ;;
  */tsconfig*.json|tsconfig*.json) matches_rule=true ;;
  .esbuild-web-extra-settings.json) matches_rule=true ;;
  .github/*|.github/**) matches_rule=true ;;
esac

if [[ "$matches_rule" != true ]]; then
  exit 0
fi

jq -nc --arg file "$REL_PATH" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: (
      "Edited path matches doc-maintenance scope: " + $file +
      ". Automatically invoke the doc-maintenance subagent now, run it in background when available, and let it apply docs updates directly before final response."
    )
  }
}'
