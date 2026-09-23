#!/usr/bin/env bash
# Decide whether .github/workflows/rerunPushE2E.yml should rerun failed jobs.
# A gate miss exits 0. `gh run rerun` failure exits non-zero.
set -euo pipefail

skip() {
  echo "skip: $*"
  exit 0
}

to_epoch() {
  date -u -d "$1" +%s 2>/dev/null || date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s 2>/dev/null
}

[ "${EVENT:-}" = "push" ] || skip "event=${EVENT:-}"

if [ "${ACTOR:-}" != "svc-idee-bot" ]; then
  state=$(gh api "orgs/forcedotcom/teams/ide-foundations/memberships/${ACTOR:-}" -q .state || true)
  [ "$state" = "active" ] || skip "membership=${state}"
fi

case "${CONCLUSION:-}" in
  failure | timed_out) ;;
  cancelled)
    started=$(to_epoch "${RUN_STARTED_AT:-}") || skip "bad run_started_at"
    ended=$(to_epoch "${UPDATED_AT:-}") || skip "bad updated_at"
    elapsed=$((ended - started))
    [ "$elapsed" -ge 3000 ] || skip "cancel elapsed=${elapsed}s"
    ;;
  *) skip "conclusion=${CONCLUSION:-}" ;;
esac

[[ "${RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]] || skip "bad run_attempt"
[ "$RUN_ATTEMPT" -lt 4 ] || skip "run_attempt=${RUN_ATTEMPT}"

if [ "${RERUN_PUSH_E2E_DECIDE_ONLY:-}" = "1" ]; then
  echo "rerun"
  exit 0
fi

gh run rerun "$RUN_ID" --failed --repo "$REPO"
