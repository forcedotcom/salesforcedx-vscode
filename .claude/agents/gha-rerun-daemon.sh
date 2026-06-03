#!/usr/bin/env bash
# gha-rerun-daemon — watch PRs by @me on forcedotcom/salesforcedx-vscode,
# rerun failed jobs up to 3x, notify when maxed. No LLM, pure gh+jq.
set -u

REPO="forcedotcom/salesforcedx-vscode"
LOG="${CLAUDE_PROJECT_DIR:-$HOME}/.claude/gha-rerun.log"
NOTIFIED="/tmp/gha-rerun-notified.txt"
POLL=60
MAX_ATTEMPTS=4

: > "$LOG"
: > "$NOTIFIED"

log() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*" >> "$LOG"; }

is_excluded() {
  case "$1" in
    "End to End Tests"|"Apex End to End Tests"|"LSP End to End Tests"|"LWC End to End Tests") return 0 ;;
    *) return 1 ;;
  esac
}

log "daemon started pid=$$ repo=$REPO poll=${POLL}s max_attempts=$MAX_ATTEMPTS"

while true; do
  prs=$(gh pr list --repo "$REPO" --author @me --state open \
        --json number,headRefOid,url --limit 100 2>>"$LOG") || {
    log "gh pr list failed; sleeping"
    sleep "$POLL"; continue
  }
  count=$(jq 'length' <<<"$prs")
  log "scan: $count open PR(s)"

  i=0
  while [ "$i" -lt "$count" ]; do
    num=$(jq -r ".[$i].number" <<<"$prs")
    sha=$(jq -r ".[$i].headRefOid" <<<"$prs")
    url=$(jq -r ".[$i].url" <<<"$prs")
    i=$((i+1))

    runs=$(gh api "/repos/$REPO/actions/runs?head_sha=$sha&per_page=100" 2>>"$LOG") || {
      log "PR #$num: gh api runs failed for sha $sha"
      continue
    }

    while IFS= read -r run; do
      [ -z "$run" ] && continue
      name=$(jq -r '.name' <<<"$run")
      status=$(jq -r '.status' <<<"$run")
      conclusion=$(jq -r '.conclusion' <<<"$run")
      attempt=$(jq -r '.run_attempt' <<<"$run")
      rid=$(jq -r '.id' <<<"$run")

      is_excluded "$name" && continue
      [ "$status" != "completed" ] && continue
      case "$conclusion" in
        failure|timed_out) ;;
        *) continue ;;
      esac

      if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
        log "PR #$num: rerun --failed workflow='$name' run=$rid attempt=$attempt"
        gh run rerun "$rid" --failed --repo "$REPO" >>"$LOG" 2>&1 \
          || log "PR #$num: rerun failed for run=$rid"
      else
        if grep -qxF "$rid" "$NOTIFIED"; then
          continue
        fi
        log "PR #$num: MAXED workflow='$name' run=$rid attempt=$attempt → notify"
        terminal-notifier \
          -title "PR #$num CI stuck" \
          -subtitle "$name" \
          -message "Failed after $attempt attempts. Click to open PR." \
          -open "$url" \
          -sound default >>"$LOG" 2>&1 || log "terminal-notifier failed"
        echo "$rid" >> "$NOTIFIED"
      fi
    done < <(jq -c '.workflow_runs[]' <<<"$runs")
  done

  sleep "$POLL"
done
