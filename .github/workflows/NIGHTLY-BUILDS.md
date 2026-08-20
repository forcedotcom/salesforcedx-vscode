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

Automated Mon 8 AM UTC: `buildReleaseFromPrerelease.yml` auto-detects latest promoted prerelease via `marketplace-prerelease-*` tracking tags (created by promote-prerelease.yml Wed 7 AM UTC after E2E tests pass), builds stable VSIXs from that tested candidate. Manual trigger for on-demand:

```bash
# Auto-detect latest promoted prerelease
gh workflow run buildReleaseFromPrerelease.yml

# Specify prerelease tag
gh workflow run buildReleaseFromPrerelease.yml \
  -f prereleaseTag="v67.11.1-nightly.develop.20260812" \
  -f releaseVersion="67.12.0"

# Emergency: build from hotfix branch
gh workflow run buildReleaseFromPrerelease.yml \
  -f startFromRef="hotfix/security-fix" \
  -f releaseVersion="67.12.1"

# Emergency: build from specific commit
gh workflow run buildReleaseFromPrerelease.yml \
  -f startFromRef="abc123def456" \
  -f releaseVersion="67.12.1"
```

**Detection priority:** `startFromRef` → `prereleaseTag` → auto-detect latest promoted prerelease via tracking tag

**How it works:**
- Queries `marketplace-prerelease-*` tracking tags (newest first)
- Extracts version from tracking tag
- Finds nightly tag with that version (points to tested candidate)
- Creates isolated `release-staging/v{version}` branch from nightly tag
- Commits version changes to isolated branch
- Builds stable release from that branch

Creates GitHub pre-release w/ VSIX + SHA256. Isolated branch prevents merge to develop. Test, then trigger [publishVSCode.yml](./publishVSCode.yml) for marketplace publish.

**After publish, delete isolated branch:**
```bash
git push origin --delete release-staging/v{version}
```

Do NOT cherry-pick the version-bump commit to develop.

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
