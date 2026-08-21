# Nightly Prerelease Builds

Automated nightly VS Code extension builds via `salesforcecli/github-workflows` shared CI.

## Usage

### Automatic

Daily 4 AM UTC: publishes all extensions as prereleases. New extensions auto-included via dynamic discovery.

#### Manual Trigger

```bash
# Publish all (dynamically discovered)
gh workflow run nightly.yml

# Publish specific extensions only
gh workflow run nightly.yml -f extensions="salesforcedx-vscode-apex,salesforcedx-vscode-core"

# Dry-run (no publish)
gh workflow run nightly.yml -f dry-run=true
```

## Building Release Versions for Testing

Automated Mon 8 AM UTC: `build-release.yml` auto-detects latest promoted prerelease via `marketplace-prerelease-*` tracking tags (created Wed 7 AM UTC post-E2E), builds stable VSIXs from tested candidate. Supports emergency pre-releases via 2-step workflow.

Manual trigger:

```bash
# Auto-detect → stable release
gh workflow run build-release.yml

# Specify prerelease tag
gh workflow run build-release.yml \
  -f prereleaseTag="v67.11.1-nightly.develop.20260812" \
  -f releaseVersion="67.12.0"

# Step 1: Build emergency pre-release VSIXs (no version bump)
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="hotfix/security-fix"

# Step 2: Publish to marketplace as pre-release
gh workflow run promote-prerelease.yml \
  -f releaseTag="v67.13.7-nightly.develop.20260820"

# Stable from arbitrary ref (version bump)
gh workflow run build-release.yml \
  -f startFromRef="abc123def456" \
  -f releaseVersion="67.12.1"
```

**Detection priority:** `startFromRef` → `prereleaseTag` → auto-detect latest promoted prerelease

**Stable release mode:**
- Queries `marketplace-prerelease-*` tracking tags (newest first)
- Extracts version, finds matching nightly tag
- Creates isolated `release-staging/v{version}` branch
- Commits version changes, builds release
- Outputs GitHub pre-release w/ VSIX + SHA256
- Delete isolated branch post-publish:
  ```bash
  git push origin --delete release-staging/v{version}
  ```

**Emergency pre-release mode — 2-step workflow:**

1. **build-release.yml with `publishAsPrerelease=true`**
   - Tags source ref directly (no version bump)
   - Creates "Emergency Pre-release" GitHub release w/ VSIX + SHA256
   - Skips isolated branch

2. **promote-prerelease.yml with `releaseTag=...`**
   - Publishes Step 1's VSIXs to marketplace (Microsoft + Open VSX) as pre-release
   - Uses nightly tag format: `v{major}.{minor}.{patch}-nightly.develop.{YYYYMMDD}`
   - Timeline: ~5 min total (build + promote)

Both modes: test VSIX, then trigger [publishVSCode.yml](./publishVSCode.yml). Do NOT cherry-pick version-bump commits to develop.

## Extension Discovery

Nightly builds use `scripts/list-vscode-extensions.js` — scans `packages/` for VS Code extensions:
- Filters: `engines.vscode`, `publisher`, `categories`; name starts `salesforcedx-vscode` (includes main bundle)
- Returns comma-separated list (sorted)
- Auto-included without workflow changes

Published releases extract extension names from VSIX filenames in release assets via `gh release view` + `sed`. Supports stable (`-1.2.3.vsix`) and prerelease (`-1.2.3-beta.vsix`, `-1.2.3-nightly.1.vsix`) formats.

## Architecture

`nightly.yml` delegates to shared reusable workflow:
- **Workflow**: `salesforcecli/github-workflows/.github/workflows/vscode-publish-extensions.yml@main`
- **Git Identity**: `get-git-identity` job queries `getGithubUserInfo` action; provides username/email to publish job
- **Scripts**: Downloaded at runtime (not stored locally)
- **Actions**: check-ci-status, calculate-artifact-name, publish-vsix

## Configuration

### Required Secrets (repo settings)
- `IDEE_GH_TOKEN` — GitHub token for version bumps/releases
- `VSCE_PERSONAL_ACCESS_TOKEN` — VS Code Marketplace
- `IDEE_OVSX_PAT` — Open VSX Registry

### Environment Variables
- `VSCE_PRE_RELEASE=true` — Set by wireit in legacy extension packaging to pass `--pre-release` flag to vsce
  - Used by: salesforcedx-vscode-core, lwc, lightning, apex-debugger, apex-oas
  - Script: `scripts/vsce-bundled-extension.ts`

### Package Scripts
- `package:packages` — Stable packaging (calls `vscode:package`)
- `package:packages:prerelease` — Prerelease packaging (calls `vscode:package:prerelease`)
  - Modern extensions: adds `--pre-release` flag to vsce
  - Legacy extensions: sets `VSCE_PRE_RELEASE=true` env var

## Emergency Patch Releases

For critical hotfixes, use patch workflows instead of normal cycle.

### Patch workflows

**Create patch branch:** [`create-patch-release-branch.yml`](./create-patch-release-branch.yml)
- Creates `release-base/vX.Y.x` from existing release tag
- Auto-copies + verifies version helper scripts from develop (old tags may lack them)
- `gh workflow run create-patch-release-branch.yml -f baseVersion="67.12.0"`

**Build patch:** [`build-patch-release.yml`](./build-patch-release.yml)
- Filters for stable tags only (excludes nightly/prerelease before sorting)
- Auto-increments patch version (v67.12.0 → v67.12.1)
- Tags with `--target "$TAG"` to ensure release points to exact commit
- Creates GitHub pre-release with VSIX + cherry-pick instructions (filters out version-bump commits)
- `gh workflow run build-patch-release.yml -f releaseBranch="release-base/v67.12.x"`

### Patch release flow

1. Run `create-patch-release-branch.yml` with base version (e.g., 67.12.0)
2. Push fixes to `release-base/v67.12.x`
3. Run `build-patch-release.yml` to tag and build
4. Test VSIX from pre-release
5. Trigger `publishVSCode.yml` to publish
6. Cherry-pick fixes to develop
7. Delete release-base branch

See [publishing.md](../../contributing/publishing.md#emergency-patch-releases) for details.

## Implementation Details

See:
- [github-workflows](https://github.com/salesforcecli/github-workflows)
- [apex-language-support scripts](https://github.com/forcedotcom/apex-language-support/tree/main/.github/scripts)

Repo is a **consumer** of shared infrastructure — calls reusable workflow, scripts maintained externally.
