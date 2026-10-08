#!/usr/bin/env bash
# Decide whether .github/workflows/rerunPushE2E.yml should rerun failed jobs
# or jobs cancelled at their own timeout-minutes. A gate miss exits 0.
# A failed `gh run rerun` exits non-zero.
set -euo pipefail

skip() {
  echo "skip: $*"
  exit 0
}

to_epoch() {
  date -u -d "$1" +%s 2>/dev/null || date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s 2>/dev/null
}

# LWC e2e-desktop-run-tests, including "<job> (<matrix>)" names, is 90 minutes. Other push-suite jobs are 60.
timeout_seconds_for_job() {
  if [[ "${WORKFLOW_NAME:-}" == "LWC E2E (Playwright)" && ( "$1" == "e2e-desktop-run-tests" || "$1" == e2e-desktop-run-tests\ * ) ]]; then
    echo 5400
    return 0
  fi
  echo 3600
}

collect_timeout_job_ids() {
  local jobs_tsv="$1"
  local id name conclusion started completed start_epoch end_epoch elapsed limit
  [ -n "$jobs_tsv" ] || return 0
  while IFS=$'\t' read -r id name conclusion started completed; do
    [ "$conclusion" = "cancelled" ] || continue
    [ -n "$id" ] || continue
    [ -n "$started" ] && [ "$started" != "null" ] || continue
    [ -n "$completed" ] && [ "$completed" != "null" ] || continue
    start_epoch=$(to_epoch "$started") || continue
    end_epoch=$(to_epoch "$completed") || continue
    elapsed=$((end_epoch - start_epoch))
    limit=$(timeout_seconds_for_job "$name")
    [ "$elapsed" -ge "$limit" ] || continue
    printf '%s\n' "$id"
  done <<< "$jobs_tsv"
}

rerun_failed() {
  if [ "${RERUN_PUSH_E2E_DECIDE_ONLY:-}" = "1" ]; then
    echo "rerun"
    exit 0
  fi
  gh run rerun "$RUN_ID" --failed --repo "$REPO"
}

rerun_cancelled_timeouts() {
  local jobs_tsv timeout_ids selected
  jobs_tsv=$(gh api "repos/${REPO}/actions/runs/${RUN_ID}/jobs" --paginate --jq '.jobs[] | [.id, .name, .conclusion, .started_at, .completed_at] | @tsv')
  timeout_ids=$(collect_timeout_job_ids "$jobs_tsv")
  [ -n "$timeout_ids" ] || skip "concurrency cancel"
  if [ "${RERUN_PUSH_E2E_DECIDE_ONLY:-}" = "1" ]; then
    echo "rerun"
    exit 0
  fi
  # A second /jobs/{id}/rerun 403s once the run is in progress. One --job this pass; a later completed run with run_attempt < 4 takes a remaining timed-out id.
  selected=${timeout_ids%%$'\n'*}
  gh run rerun --job "$selected" --repo "$REPO"
}

[ "${EVENT:-}" = "push" ] || skip "event=${EVENT:-}"

if [ "${ACTOR:-}" != "svc-idee-bot" ] && [ "${ACTOR:-}" != "dependabot[bot]" ]; then
  state=$(gh api "orgs/forcedotcom/teams/ide-foundations/memberships/${ACTOR:-}" -q .state || true)
  [ "$state" = "active" ] || skip "membership=${state}"
fi

case "${CONCLUSION:-}" in
  failure | timed_out | cancelled) ;;
  *) skip "conclusion=${CONCLUSION:-}" ;;
esac

[[ "${RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]] || skip "bad run_attempt"
[ "$RUN_ATTEMPT" -lt 4 ] || skip "run_attempt=${RUN_ATTEMPT}"

if [ "$CONCLUSION" = "cancelled" ]; then
  rerun_cancelled_timeouts
else
  rerun_failed
fi
