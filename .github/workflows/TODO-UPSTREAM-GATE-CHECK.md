# TODO: Configure Upstream Gate-Check

## Overview
`promote-prerelease.yml` (this repo) delegates to upstream `salesforcecli/github-workflows/.github/workflows/vscode-promote-prerelease.yml` which verifies CI checks passed on nightly candidate before promoting to marketplace prerelease. Ensures only tested versions reach customers.

## Current State
- Upstream workflow has `quality-gate` step that checks CI status on the nightly candidate
- This check **must be configured** with exact check names this repo emits
- Currently check names may not match what this repo produces
- Without proper configuration, promotion could bypass quality gates

## Required Actions

### 1. Identify this repository's CI check names
Run this command to see what checks are created on commits:

```bash
# Get a recent commit SHA
COMMIT=$(git rev-parse HEAD~5)

# List all checks for that commit
gh api repos/forcedotcom/salesforcedx-vscode/commits/$COMMIT/check-runs --jq '.check_runs[].name'
```

Example output might include:
- `test (ubuntu-latest, 20.x)`
- `test (windows-latest, 20.x)` 
- `build-and-test`
- `lint`
- etc.

### 2. Update upstream workflow configuration
In `salesforcecli/github-workflows/.github/workflows/vscode-promote-prerelease.yml`, configure the `quality-gate` step to check for the actual CI check names from step 1.

Example configuration:
```yaml
- name: Check CI status for candidate commit
  uses: salesforcecli/github-workflows/.github/actions/vscode/check-ci-status@main
  with:
    commit-sha: ${{ needs.find-nightly-candidate.outputs.commit-sha }}
    required-checks: |
      test (ubuntu-latest, 20.x)
      test (windows-latest, 20.x)
      build-and-test
    token: ${{ secrets.IDEE_GH_TOKEN }}
```

### 3. Verify gate check works
After configuration:

1. Create test branch with failing test
2. Create nightly from that branch
3. Wait for scheduled promotion (Wed 7 AM UTC)
4. Verify promotion blocked due to failing checks
5. Fix test
6. Verify promotion succeeds on next scheduled run

## Related Files
- `.github/workflows/promote-prerelease.yml` (this repo)
- `salesforcecli/github-workflows/.github/workflows/vscode-promote-prerelease.yml` (upstream)
- `salesforcecli/github-workflows/.github/actions/vscode/check-ci-status/action.yml` (upstream)

## References
- PR #7995 implementation gap #11
- Scenario document: `/Users/madhur.shrivastava/Downloads/PR-7995-WORKFLOW-SCENARIOS.md`
