#!/usr/bin/env bash
# Summarize release-train state without dispatching, approving, or publishing anything.
set -euo pipefail

REPO=${REPO:?REPO is required}
SUMMARY=${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}

api() {
  gh api "$1"
}

check_runs_for() {
  gh api --paginate "repos/$REPO/commits/$1/check-runs?per_page=100" --jq '.check_runs[]' | jq -s '{check_runs: .}'
}

latest_run() {
  local workflow="$1"
  local extension_release_only=${2:-false}
  jq -c --arg workflow "$workflow" --argjson extension_release_only "$extension_release_only" '
    [ .workflow_runs[]
      | select(.name == $workflow)
      | select(($extension_release_only | not) or (.display_title | test("^Release v[0-9]+\\."))) ]
    | sort_by(.created_at) | reverse | .[0] // {}'
}

run_state() {
  local run="$1"
  local status conclusion
  status=$(jq -r '.status // "not run"' <<< "$run")
  conclusion=$(jq -r '.conclusion // empty' <<< "$run")
  if [ -n "$conclusion" ] && [ "$conclusion" != "null" ]; then
    printf '%s' "$conclusion"
  else
    printf '%s' "$status"
  fi
}

run_link() {
  jq -r 'if .html_url then "[run](" + .html_url + ")" else "not found" end' <<< "$1"
}

check_health() {
  local checks="$1"
  local check_name="$2"
  local check
  check=$(jq -c --arg name "$check_name" '
    [.check_runs[] | select(.name == $name and .app.id == 15368)]
    | sort_by(.started_at // "") | reverse | .[0] // {}' <<< "$checks")
  if [ "$(jq -r '.status // empty' <<< "$check")" != 'completed' ]; then
    printf '%s' 'not verified'
  elif [ "$(jq -r '.conclusion // empty' <<< "$check")" = 'success' ]; then
    printf '%s' 'success'
  else
    printf '%s' 'failure'
  fi
}

e2e_health() {
  local run="$1"
  local develop_sha="$2"
  local state
  state=$(run_state "$run")
  if [ "$state" = 'not run' ]; then
    printf '%s' 'no develop run'
  elif [ "$(jq -r '.head_sha // empty' <<< "$run")" != "$develop_sha" ]; then
    printf '%s' "$state (historical)"
  else
    printf '%s' "$state"
  fi
}

tracking_tags() {
  if [ -n "${RELEASE_DASHBOARD_TRACKING_TAGS:-}" ]; then
    printf '%s\n' "$RELEASE_DASHBOARD_TRACKING_TAGS"
  else
    git tag -l 'marketplace-prerelease-*' --sort=-creatordate
  fi
}

releases=$(api "repos/$REPO/releases?per_page=100")
nightly_runs=$(api "repos/$REPO/actions/workflows/nightly.yml/runs?per_page=100")
promotion_runs=$(api "repos/$REPO/actions/workflows/promote-to-prerelease.yml/runs?per_page=100")
stable_build_runs=$(api "repos/$REPO/actions/workflows/build-github-release.yml/runs?per_page=100")
marketplace_runs=$(api "repos/$REPO/actions/workflows/publishVSCode.yml/runs?per_page=100")
openvsx_runs=$(api "repos/$REPO/actions/workflows/publishOpenVSX.yml/runs?per_page=100")
develop_sha=$(api "repos/$REPO/branches/develop" | jq -r '.commit.sha')
develop_checks=$(check_runs_for "$develop_sha")
develop_e2e_runs=$(api "repos/$REPO/actions/workflows/e2e.yml/runs?branch=develop&per_page=100")
nightly=$(latest_run 'Nightly Release' <<< "$nightly_runs")
promotion=$(latest_run 'Promote to Pre-release' <<< "$promotion_runs")
stable_build=$(latest_run 'Build GitHub Release' <<< "$stable_build_runs")
marketplace=$(latest_run 'Publish Release to Marketplace' true <<< "$marketplace_runs")
openvsx=$(latest_run 'Publish in Open VSX Registry' true <<< "$openvsx_runs")
develop_e2e=$(latest_run 'End to End Tests' <<< "$develop_e2e_runs")
build_health=$(check_health "$develop_checks" 'build-and-test / build-all / build-all')
linux_unit_health=$(check_health "$develop_checks" 'build-and-test / unit-tests / linux-unit-tests / linux-unit-tests')
windows_unit_health=$(check_health "$develop_checks" 'build-and-test / unit-tests / windows-unit-tests / windows-unit-tests')
e2e_state=$(e2e_health "$develop_e2e" "$develop_sha")
hard_test_health='verified'
if [ "$build_health" = 'failure' ] || [ "$linux_unit_health" = 'failure' ] || [ "$windows_unit_health" = 'failure' ]; then
  hard_test_health='hard no'
elif [ "$build_health" != 'success' ] || [ "$linux_unit_health" != 'success' ] || [ "$windows_unit_health" != 'success' ]; then
  hard_test_health='not verified'
fi

tracking_tag=$(tracking_tags | head -1 || true)
tracking_version=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' <<< "$tracking_tag" | head -1 || true)
stable_source='not available'
expected_stable='not available'
stable_tag_state='not available'

while IFS= read -r candidate_tracking_tag; do
  [ -n "$candidate_tracking_tag" ] || continue
  candidate_version=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' <<< "$candidate_tracking_tag" | head -1 || true)
  [ -n "$candidate_version" ] || continue
  candidate_source=$(git tag -l "v${candidate_version}-nightly.develop.*" --sort=-v:refname | head -1 || true)
  [ -n "$candidate_source" ] || continue
  tracking_tag=$candidate_tracking_tag
  tracking_version=$candidate_version
  stable_source=$candidate_source
  expected_stable="v$(node scripts/calculate-release-version.js "$stable_source")"
  if git rev-parse --verify --quiet "$expected_stable" >/dev/null; then
    stable_tag_state='already exists'
  else
    stable_tag_state='available'
  fi
  break
done < <(tracking_tags)

published_nightly=$(jq -r '[.[] | select(.prerelease and (.name | endswith(" - published"))) | .tag_name] | first // "not found"' <<< "$releases")
stable_candidate=$(jq -r '[.[] | select(.prerelease and (.name | contains("Ready for Testing"))) | .tag_name] | first // "not found"' <<< "$releases")
approved_stable=$(jq -r '[.[] | select((.prerelease | not) and (.name | contains("Tested & Approved"))) | .tag_name] | first // "not found"' <<< "$releases")

expected_stable_release=$(jq -r --arg tag "$expected_stable" '.[] | select(.tag_name == $tag) | .name // empty' <<< "$releases")

blocker='None detected from the latest workflow snapshots.'
next_action='Monitor the scheduled release train.'
# Nightly runs daily but promotion only runs Wednesdays, so a successful promotion run can
# predate a since-failed nightly; only treat promotion as covering the latest nightly if it ran after it.
nightly_created_at=$(jq -r '.created_at // empty' <<< "$nightly")
promotion_created_at=$(jq -r '.created_at // empty' <<< "$promotion")
promotion_covers_nightly=false
if [ "$(run_state "$promotion")" = 'success' ] && [ -n "$promotion_created_at" ] && [ -n "$nightly_created_at" ] \
  && [[ "$promotion_created_at" > "$nightly_created_at" ]]; then
  promotion_covers_nightly=true
fi
if [ "$(run_state "$nightly")" = 'failure' ] && [ "$promotion_covers_nightly" = false ] && [ "$stable_candidate" = 'not found' ]; then
  blocker='Latest nightly failed. Promotion cannot pass its required nightly package/release checks until the candidate is repaired or rerun.'
  next_action='Inspect and recover the nightly before rerunning promotion; do not rerun the stable build until a new prerelease tracking tag exists.'
elif [ "$(run_state "$promotion")" = 'failure' ]; then
  blocker='Latest prerelease promotion failed. The next stable build will use older tracking state or fail to find a valid source.'
  next_action='Repair or rerun promotion, confirm a new published nightly and tracking tag, then rerun the stable build if its scheduled window has passed.'
elif [ "$(run_state "$stable_build")" = 'failure' ]; then
  blocker='Latest stable-candidate build failed. Inspect its selected source and any release tag it created before rerunning.'
  next_action='Repair the stable build failure. Do not use an emergency source override for routine release-train recovery.'
elif [ "$(run_state "$marketplace")" = 'failure' ] || [ "$(run_state "$openvsx")" = 'failure' ]; then
  blocker='At least one registry publication workflow requires inspection. A workflow-level failure can occur after publication, so verify the publish job before retrying.'
  next_action='Open the failed registry workflow and inspect its publish and verification jobs before dispatching any retry.'
elif [ "$hard_test_health" = 'hard no' ]; then
  blocker='The current develop commit has an explicit failed build or unit-test check. Do not select it as a new release input until the failure is understood.'
  next_action='Inspect the failed develop check. E2E results remain advisory and do not change this hard-gate verdict.'
elif [ "$stable_tag_state" = 'already exists' ] && [ -z "$expected_stable_release" ]; then
  blocker="Expected stable tag $expected_stable already exists without a current Ready for Testing release. It may be an incomplete or stale build."
  next_action='Inspect the existing tag and originating build before dispatching another default stable build.'
elif [ "$stable_candidate" != 'not found' ]; then
  next_action="Complete recorded manual QA for $stable_candidate. Only then mark it Tested & Approved and review both publish-environment approvals."
elif [ "$published_nightly" != 'not found' ]; then
  next_action='The promoted nightly is the next stable-build input. Wait for, or inspect, the next Build GitHub Release run.'
fi

{
  echo '# Releasability Dashboard'
  echo
  echo "Snapshot: $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo
  echo '## Release Train'
  echo '| Stage | State | Evidence |'
  echo '| --- | --- | --- |'
  echo "| Nightly | $(run_state "$nightly") | $(run_link "$nightly") |"
  echo "| Promote to pre-release | $(run_state "$promotion") | $(run_link "$promotion") |"
  echo "| Build stable candidate | $(run_state "$stable_build") | $(run_link "$stable_build") |"
  echo "| Publish VS Code Marketplace | $(run_state "$marketplace") | $(run_link "$marketplace") |"
  echo "| Publish Open VSX | $(run_state "$openvsx") | $(run_link "$openvsx") |"
  echo
  echo '## Test Health - develop'
  echo "Feeder commit: \`$develop_sha\`"
  echo
  echo '| Signal | Policy | State |'
  echo '| --- | --- | --- |'
  echo "| Build and package | Hard no | $build_health |"
  echo "| Unit tests (Linux) | Hard no | $linux_unit_health |"
  echo "| Unit tests (Windows) | Hard no | $windows_unit_health |"
  echo "| End-to-end aggregate | Advisory | $e2e_state ($(run_link "$develop_e2e")) |"
  echo
  echo "**Develop hard-gate verdict:** $hard_test_health"
  echo
  echo '> Hard-no checks only become green when they exist and succeeded on the current develop commit. Missing or in-progress checks are not verified, not successful. Current repository automation runs these checks on merged PR heads, so develop commonly has no direct check evidence.'
  echo '> E2E failures are an investigation signal, not an automatic release stop. Historical means the latest develop E2E run did not test the current feeder commit.'
  echo
  echo '## Artifacts'
  echo "| Artifact | Value |"
  echo '| --- | --- |'
  echo "| Published marketplace prerelease | $published_nightly |"
  echo "| Stable candidate awaiting QA | $stable_candidate |"
  echo "| Last approved stable release | $approved_stable |"
  echo "| Latest prerelease tracking tag | ${tracking_tag:-not found} |"
  echo "| Stable build source resolved from tracking tag | $stable_source |"
  echo "| Expected stable tag | $expected_stable ($stable_tag_state) |"
  echo
  echo '## Assessment'
  echo "**Blocker:** $blocker"
  echo
  echo "**Safe next action:** $next_action"
  echo
  echo '> This is a read-only snapshot. The Wednesday stable build intentionally consumes the prior promoted prerelease; it is not expected to consume the promotion that runs an hour later.'
  echo '> Workflow results are evidence of publication attempts. Manual QA and environment approvals remain human release-manager decisions.'
} >> "$SUMMARY"
