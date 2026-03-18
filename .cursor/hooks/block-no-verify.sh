#!/usr/bin/env bash
# Block git with --no-verify. beforeShellExecution hook (matcher: git.*--no-verify).
input=$(cat)
command=$(echo "$input" | jq -r '.command // empty')
[[ "$command" =~ git.*--no-verify ]] && echo '{"permission":"deny","agent_message":"git with --no-verify is blocked. Run without --no-verify so hooks run."}' || echo '{"permission":"allow"}'
