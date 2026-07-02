# Shared preamble for Bash PreToolUse hooks. Source it, then use $command.
# Reads stdin JSON, gates on tool_name==Bash, sets $command and $cwd.
# https://code.claude.com/docs/en/hooks.md
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
[[ "$tool_name" != "Bash" ]] && exit 0
command=$(echo "$input" | jq -r '.tool_input.command // .command // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')
[[ -z "$cwd" ]] && cwd="$PWD"
