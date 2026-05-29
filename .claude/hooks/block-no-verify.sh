#!/usr/bin/env bash
# Block git with --no-verify. PreToolUse hook (matcher: Bash).
# Reads tool input on stdin and inspects the .command field.
# https://code.claude.com/docs/en/hooks.md
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
[[ "$tool_name" != "Bash" ]] && exit 0
command=$(echo "$input" | jq -r '.tool_input.command // .command // empty')
[[ "$command" =~ git.*--no-verify ]] && cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"git with --no-verify is blocked. Run without --no-verify so hooks run."}}
EOF
exit 0
