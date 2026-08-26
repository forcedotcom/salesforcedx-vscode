# Gate-Check Implementation: Completed

**Status:** Resolved inversion of control. Repo now owns promotion criteria.

## Problem Solved

Originally, `vscode-promote-prerelease.yml` (upstream) decided when a nightly was "good enough" to promote. This created **inversion of control**: upstream controlled quality gates, not consuming repos. Fixed by moving gate-check to consuming repos.

## Architecture: 3-Stage Promotion Flow

```
promote-prerelease.yml (THIS REPO)
├─ Stage 1: find-nightly (uses shared vscode-find-nightly-candidate.yml)
├─ Stage 2: gate-check (inline, calls shared check-ci-status action)
└─ Stage 3: promote (uses shared vscode-promote-prerelease.yml, publishing-only)
```

**Key principle:** This repo controls criteria, shared workflows provide tools.

## Implementation

### Current Flow

1. **find-nightly** (shared workflow)
   - Finds eligible nightly tag
   - Outputs: `nightly-tag`, `commit-sha`

2. **gate-check** (inline job, THIS REPO DECIDES)
   - Calls: `salesforcecli/github-workflows/.github/actions/vscode/check-ci-status@main`
   - Requires: `unit-tests`, `build-all` checks to pass
   - Fails fast if checks didn't pass

3. **promote** (shared workflow, publishing-only)
   - Downloads VSIXs
   - Publishes to VS Code Marketplace + Open VSX
   - Only runs if gate-check passed

### Benefits

- **Control:** This repo decides which checks are required
- **Transparency:** Gate-check visible in this repo's Actions UI
- **Flexibility:** Easy to change required checks without upstream coordination
- **Fail-fast:** Fails before wasting upstream resources

### Key Files

- `.github/workflows/promote-prerelease.yml` — Orchestrates 3-stage flow
- `.github/workflows/vscode-find-nightly-candidate.yml` — Shared workflow (upstream)
- `.github/actions/vscode/check-ci-status` — Shared action (upstream)

## Testing

To verify gate-check works:

1. Create test branch with failing test
2. Create nightly from that branch
3. Wait for scheduled promotion (Wed 7 AM UTC)
4. Verify promotion blocked due to failing checks
5. Fix test
6. Verify promotion succeeds on next scheduled run

## Related Work

- **PR #7995:** Implementation of 3-stage promotion + emergency paths
- **Upstream repos:** `salesforcecli/github-workflows`, `apex-language-support`
- **Full architecture:** See `docs/release-workflow-architecture.md`
