#!/usr/bin/env bash
# Block git with --no-verify. PreToolUse hook (matcher: Bash).
# Reads tool input on stdin and inspects the .command field.
# https://code.claude.com/docs/en/hooks.md
source "$(dirname "${BASH_SOURCE[0]}")/lib/bash-hook-preamble.sh"
[[ "$command" =~ git.*--no-verify ]] && cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"git with --no-verify is blocked. Run without --no-verify so hooks run."}}
EOF
exit 0
