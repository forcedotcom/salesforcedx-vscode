#!/usr/bin/env bash
# Block `git push` when node_modules is missing at the target repo root.
# PreToolUse hook (matcher: Bash). Without deps, local lint/compile hooks
# error (`wireit: command not found`) instead of catching issues, so a push
# ships unverified code (see PR 7634 incident).
# https://code.claude.com/docs/en/hooks.md
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
[[ "$tool_name" != "Bash" ]] && exit 0
command=$(echo "$input" | jq -r '.tool_input.command // .command // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')
[[ -z "$cwd" ]] && cwd="$PWD"

# Detect `push` at the git-subcommand position (not bag-of-tokens): after an
# optional `-C <dir>` and any global flags. Value-taking flags (`-c name=val`,
# `--namespace ns`) put the value in a separate token, so allow an optional
# non-dash value token after each flag before the `push` subcommand.
cmd_no_cdir=$(echo "$command" | sed -E 's/git[[:space:]]+-C[[:space:]]+[^[:space:]]+/git/')
[[ "$cmd_no_cdir" =~ git[[:space:]]+(-[^[:space:]]+[[:space:]]+([^-[:space:]][^[:space:]]*[[:space:]]+)?)*push([[:space:]]|$) ]] || exit 0

# Resolve target dir in priority order.
dir=""
# 1. leading `cd <dir> &&|;` prefix (strip leading VAR=val assignments first).
normalized=$(echo "$command" | sed -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*//')
if [[ "$normalized" =~ ^cd[[:space:]]+([^\;\&]+) ]]; then
  cd_dir="${BASH_REMATCH[1]}"
  cd_dir="${cd_dir%"${cd_dir##*[![:space:]]}"}" # trim trailing space
  cd_dir="${cd_dir#\"}"; cd_dir="${cd_dir%\"}"
  cd_dir="${cd_dir#\'}"; cd_dir="${cd_dir%\'}"
  [[ "$cd_dir" == /* ]] && dir="$cd_dir" || dir="$cwd/$cd_dir"
fi
# 2. `git -C <dir>` flag.
if [[ -z "$dir" && "$command" =~ git[[:space:]]+-C[[:space:]]+([^[:space:]]+) ]]; then
  cdir="${BASH_REMATCH[1]}"
  cdir="${cdir#\"}"; cdir="${cdir%\"}"
  cdir="${cdir#\'}"; cdir="${cdir%\'}"
  [[ "$cdir" == /* ]] && dir="$cdir" || dir="$cwd/$cdir"
fi
# 3. payload .cwd, else $PWD.
[[ -z "$dir" ]] && dir="$cwd"

root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)
[[ -z "$root" ]] && exit 0 # not a repo; let git error
{ [[ -d "$root/node_modules" ]] || [[ -L "$root/node_modules" ]]; } && exit 0

cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"node_modules missing at $root — local lint/compile hooks can't run, so a push would ship unverified code. Run 'npm install' at the repo root, then push."}}
EOF
exit 0
