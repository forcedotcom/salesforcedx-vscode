#!/usr/bin/env bash
# Block `git push` when node_modules is missing at the target repo root.
# PreToolUse hook (matcher: Bash). Without deps, local lint/compile hooks
# error (`wireit: command not found`) instead of catching issues, so a push
# ships unverified code (see PR 7634 incident).
# https://code.claude.com/docs/en/hooks.md
source "$(dirname "${BASH_SOURCE[0]}")/lib/bash-hook-preamble.sh"

# Split a compound command into segments on shell separators (&& || ; | &),
# then evaluate each segment against its own effective directory. This ties
# push-detection and dir-resolution to the SAME subcommand: a sibling
# `git -C <dir> status` can no longer hijack the dir a bare `git push` uses,
# and sequential `cd`s track the dir the push actually runs in.
segments=$(echo "$command" | sed -E 's/(\|\||&&|[;|&])/\n/g')

# Effective dir tracked across segments, seeded from payload cwd.
eff_dir="$cwd"

is_push_segment() {
  # `push` at the git-subcommand position (not bag-of-tokens): after an
  # optional `-C <dir>` and any global flags. Value-taking flags (`-c x=y`,
  # `--namespace ns`) put the value in a separate token, so allow an optional
  # non-dash value token after each flag before the `push` subcommand.
  local seg no_cdir
  seg="$1"
  no_cdir=$(echo "$seg" | sed -E 's/git[[:space:]]+-C[[:space:]]+[^[:space:]]+/git/')
  [[ "$no_cdir" =~ git[[:space:]]+(-[^[:space:]]+[[:space:]]+([^-[:space:]][^[:space:]]*[[:space:]]+)?)*push([[:space:]]|$) ]]
}

# Word-split a token respecting quotes/escapes/$VAR via the shell, so paths
# like `cd "$HOME/x"` or `cd /a\ b` resolve correctly (bespoke quote-stripping
# only handled one flat layer). eval is safe: input is Claude's own tool call.
first_word_after() {
  local seg keyword rest words
  seg="$1"; keyword="$2"
  [[ "$seg" =~ (^|[[:space:]])"$keyword"[[:space:]]+(.*) ]] || return 1
  rest="${BASH_REMATCH[2]}"
  eval "words=($rest)" 2>/dev/null || return 1
  [[ -n "${words[0]}" ]] && printf '%s' "${words[0]}"
}

check_dir() {
  local dir root
  dir="$1"
  [[ "$dir" != /* ]] && dir="$cwd/$dir"
  root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)
  [[ -z "$root" ]] && return 0 # not a repo; let git error
  { [[ -d "$root/node_modules" ]] || [[ -L "$root/node_modules" ]]; } && return 0
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"node_modules missing at $root — local lint/compile hooks can't run, so a push would ship unverified code. Run 'npm install' at the repo root, then push."}}
EOF
  exit 0
}

while IFS= read -r seg; do
  # Strip leading VAR=val assignments (mirror platform if-matcher normalization).
  seg=$(echo "$seg" | sed -E 's/^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*//')

  # A `cd` segment updates the effective dir for subsequent segments.
  if cd_target=$(first_word_after "$seg" cd); then
    [[ "$cd_target" == /* ]] && eff_dir="$cd_target" || eff_dir="$eff_dir/$cd_target"
    continue
  fi

  is_push_segment "$seg" || continue

  # Segment-local `git -C <dir>` wins over the tracked effective dir.
  if git_c=$(first_word_after "$seg" '-C'); then
    check_dir "$git_c"
  else
    check_dir "$eff_dir"
  fi
done <<< "$segments"

exit 0
