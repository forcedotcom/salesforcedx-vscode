# Publishing

> Automated walkthrough: [.claude/skills/release/SKILL.md](../.claude/skills/release/SKILL.md).

Bundle extensions as .vsix files → [VS Code Marketplace](https://marketplace.visualstudio.com/vscode) + [Open VSX Registry](https://open-vsx.org/).

References:
- [Publishing VS Code Extensions][publish_vscode_ext]
- [Managing Extensions](https://code.visualstudio.com/docs/editor/extension-gallery)
- [Publishing Extensions on Open VSX Registry](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)

## Prerequisites

- GitHub team 'IDE Experience' membership

## Build Release from Prerelease

Automated workflow [`build-release.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/build-release.yml) (Wed 8 AM UTC) → GitHub pre-release w/ VSIX + SHA256. Supports both stable releases and emergency pre-releases. Trigger manually for on-demand.

**Release notes** (minimal format): contain version/title, source ref/branch, internal testing warning, and link to [docs/release-testing-guide.md](../docs/release-testing-guide.md) for complete testing and publishing instructions. Release notes no longer embed procedural instructions.

> **Note:** `createReleaseBranch.yml` deprecated — use `build-release.yml` instead. Old workflow scheduled for deletion after proven stability (W-23988524).

**Inputs:**
- `publishAsPrerelease` — boolean flag (default: `false`). When `true`: emergency pre-release mode (no version bump, tags source ref, creates "Emergency Pre-release"). When `false`: standard mode (version bump, isolated branch, stable release).
- `startFromRef` — git ref (tag/branch/SHA) to build from (optional)
- `prereleaseTag` — prerelease tag e.g. `v67.11.1-nightly.develop.20260812` (auto-detect if empty)
- `releaseVersion` — e.g. `67.12.0` (auto-calculated if empty)

**Detection priority:** `startFromRef` → `prereleaseTag` → auto-detect via `marketplace-prerelease-*` tracking tags (finds nightly published to marketplace as prerelease, tested by customers)

**How detection works:**
1. If `startFromRef` provided, use that ref (any git ref: tag/branch/SHA) — bypasses nightly validation, for emergency releases only
2. Else if `prereleaseTag` provided, validate nightly format (`v{major}.{minor}.{patch}-nightly.develop.{YYYYMMDD}`), use that tag
3. Else auto-detect: query latest `marketplace-prerelease-*` tracking tag → extract version → find matching nightly tag. Tracks Wed 7 AM UTC promotion (nightly published to marketplace + passing CI)

**Emergency Pre-release Mode (`publishAsPrerelease=true`):**
- Use for critical hotfixes that cannot wait for normal release cycle
- No version bumping — tags source ref directly
- Creates "Emergency Pre-release" GitHub release w/ VSIX + SHA256
- Example: security hotfix from hotfix branch or specific commit
- ⚠️ Bypasses nightly validation — ensure ref is reviewed/tested before using

**Standard Mode (`publishAsPrerelease=false`, default):**
- Use for regular weekly releases
- Creates isolated `release-staging/v{version}` branch
- Bumps version in isolated branch
- Creates stable release on Wednesday schedule

**Examples:**

```sh
# Standard: auto-detect latest nightly published to marketplace as prerelease
gh workflow run build-release.yml

# Standard: build from hotfix branch with version bump
gh workflow run build-release.yml \
  -f startFromRef="hotfix/security-fix" \
  -f releaseVersion="67.12.1"

# Standard: build from specific commit with version bump
gh workflow run build-release.yml \
  -f startFromRef="abc123def" \
  -f releaseVersion="67.12.1"

# Emergency pre-release: hotfix branch, no version bump
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="hotfix/security-fix"

# Emergency pre-release: specific commit, no version bump
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="abc123def456"

# Legacy: specify prerelease tag explicitly
gh workflow run build-release.yml \
  -f prereleaseTag="v67.11.1-nightly.develop.20260812"
```

**Scripts:**
- [`calculate-release-version.js`](../scripts/calculate-release-version.js) — extract prerelease, bump minor, or override; validates semver + bounds (max 9999); accepts prerelease versions like `67.12.0-beta.1`
- [`update-release-versions.js`](../scripts/update-release-versions.js) — update all publishable `package.json` + `package-lock.json`

**Isolated branch materialization:**
- Creates `release-staging/v{version}` branch from source ref (not merged to develop)
- Commits version changes to isolated branch
- Creates release tag from that branch's commit
- See [docs/release-testing-guide.md](../docs/release-testing-guide.md) for branch cleanup instructions

For complete testing and publishing workflow, see [docs/release-testing-guide.md](../docs/release-testing-guide.md).

## Nightly Builds & Pre-release Promotion

**Nightly builds:** `nightly.yml` → all extensions to pre-release daily (4 AM UTC) + on-demand. Auto-discovers via [`list-vscode-extensions.js`](../scripts/list-vscode-extensions.js).

**Weekly pre-release promotion:** `promote-nightly-to-prerelease.yml` (Wed 7 AM UTC, 3h after nightly) → 3-stage flow: select latest nightly, gate-check CI status (verifies required checks passed), promote to pre-release. Creates `marketplace-prerelease-*` tracking tag for detection.

**Wed stable release:** `build-release.yml` (Wed 8 AM UTC) → detects promoted tag via tracking tag, builds stable VSIXs. Release engineer approves + publishes.

**Artifact retention:** 30 days (vs. 5 for PR builds).

## Publishing to Marketplace

### Standard Path: Nightly → Weekly Pre-release → Wed Stable → Marketplace

1. **Wed 7 AM UTC:** `promote-nightly-to-prerelease.yml` auto-runs → 3-stage flow: select latest nightly, gate-check CI status (verifies required checks passed), promote to pre-release; creates `marketplace-prerelease-*` tracking tag
2. **Wed 8 AM UTC:** `build-release.yml` auto-runs → detects via tracking tag (finds promoted Wed candidate), builds stable VSIXs
4. Download + test VSIX files from GitHub pre-release
5. Trigger [`publishVSCode.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/publishVSCode.yml) w/ version (e.g. `67.12.0`)
   - Detects release type (prerelease vs stable) via `IS_PRERELEASE` output
   - Query release metadata to determine whether to publish as stable or prerelease
6. Approve marketplace publish gates
7. Marketplace updates within min

### ~~Merge to main (Deprecated - Old Release Branch Flow)~~

> **Deprecated:** The PreRelease → testBuildAndRelease workflow is part of the old release branch flow and should not be used. Use `build-release.yml` → `publishVSCode.yml` workflow instead (documented above).

### Web Console Release

After marketplace publish, trigger Web Console release → auto-get updated extensions.

**Automatic (default):** `publishVSCode.yml` extracts extensions → `code-builder-web` via `repository_dispatch` → polls marketplace → Web Console release w/ auto-promote to `prd`. No manual steps.

**Disable:** set repo var `CBW_TRIGGER_ENABLED=false` (Settings → Secrets and variables → Actions → Variables).

**Manual (if auto-promote broken/disabled):**

1. Go to [release.yml](https://github.com/forcedotcom/code-builder-web/actions/workflows/release.yml) in `code-builder-web`
2. **Run workflow** from `main`
3. **release-type** = `patch` (or `minor` if extension bumped minor)
4. **auto-promote** = `prd`
5. Run → builds, versions, dispatches `promote.yml` → syncs `/latest/` in production

**Re-promote:** use [promote.yml](https://github.com/forcedotcom/code-builder-web/actions/workflows/promote.yml) directly.

Details: [code-builder-web/docs/application-lifecycle.md](https://github.com/forcedotcom/code-builder-web/blob/main/docs/application-lifecycle.md).

## Closing Shipped GitHub Issues

After marketplace publish, `closePendingReleaseIssues.yml` auto-closes issues + discussions in `CHANGELOG.md`.

Or run [`/shipped-issues`](../.claude/skills/shipped-issues/SKILL.md) to close GitHub issues w/ closed GUS work items in published `CHANGELOG.md`.

## Emergency Pre-release (Hotfix → Marketplace in Minutes)

Immediate marketplace publication of hotfixes using 2-step process: **build VSIXs** + **publish pre-release**.

### When to use

- Security vulnerabilities
- Critical production bugs
- Showstoppers requiring immediate marketplace availability

### Two-step workflow

**Step 1: Build emergency pre-release VSIXs**

```sh
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="hotfix/security-fix" \
  --repo forcedotcom/salesforcedx-vscode
```

Creates GitHub pre-release w/ VSIX + SHA256 from any git ref (tag/branch/SHA). No version bump — tags source directly.

**Step 2: Promote to marketplace as pre-release**

```sh
gh workflow run promote-nightly-to-prerelease.yml \
  -f releaseTag="v67.13.7-nightly.develop.20260820" \
  --repo forcedotcom/salesforcedx-vscode
```

Publishes Step 1's VSIXs to VS Code Marketplace + Open VSX as pre-release.

**Emergency pre-release nightly tag format:** `v{major}.{minor}.{patch}-nightly.develop.{YYYYMMDD}`
- Example: `v67.13.7-nightly.develop.20260820`
- Use actual build date (not future date)

### Examples

```sh
# Hotfix from branch
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="hotfix/security-fix"

# Hotfix from specific commit
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="abc123def456"

# Promote built VSIXs to marketplace
gh workflow run promote-nightly-to-prerelease.yml \
  -f releaseTag="v67.13.7-nightly.develop.20260820"
```

### Traditional patch releases (still available)

For patches requiring formal version tracking:

**1. Create release-base branch**

```sh
gh workflow run create-patch-release-branch.yml -f baseVersion="67.12.0" --repo forcedotcom/salesforcedx-vscode
```

Creates `release-base/v67.12.x` from tag. Auto-copies latest version helper scripts from develop:
- Restores `scripts/calculate-release-version.js` + `scripts/update-release-versions.js` from develop (old tags may lack them)
- Verifies integrity via checksums
- Commits script updates to branch if needed

See [`create-patch-release-branch.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/create-patch-release-branch.yml).

**2. Apply fixes**

```sh
git fetch origin && git checkout release-base/v67.12.x
git commit -m "fix: <message>"
git push origin release-base/v67.12.x
```

**3. Build patch**

```sh
gh workflow run build-patch-release.yml -f releaseBranch="release-base/v67.12.x" --repo forcedotcom/salesforcedx-vscode
```

Auto-calculates patch version:
- Filters existing tags for stable only (`v{major}.{minor}.{patch}` — excludes `v*-nightly*`, `v*-beta*`, etc.) before sorting
- Finds latest stable tag, increments patch
- Creates and tags commit with `--target "$TAG"` to ensure release points to exact tag commit
- Builds VSIX from that commit

**4. Test VSIX**

```sh
gh release download v67.12.1 --dir ~/Downloads/v67.12.1 --pattern '*.vsix' --repo forcedotcom/salesforcedx-vscode
find ~/Downloads/v67.12.1 -type f -name "*.vsix" -exec code --install-extension {} \;
```

**5. Publish**

```sh
gh workflow run publishVSCode.yml -f version="67.12.1" --repo forcedotcom/salesforcedx-vscode
```

**6. Cherry-pick to develop**

Merge fixes back for future releases. For detailed cherry-pick workflow, see [docs/release-testing-guide.md](../docs/release-testing-guide.md).

**Filter out version-bump commits** — only cherry-pick functional fixes:

```sh
git checkout develop && git pull origin develop

# Log to identify commits; cherry-pick only non-version-bump ones:
git cherry-pick <commit-sha-1>  # fix: actual bug
git cherry-pick <commit-sha-2>  # feat: new feature
# SKIP: chore: bump versions for patch release (release-only commit)

git push origin develop
```

**7. Cleanup**

```sh
git push origin --delete release-base/v67.12.x
```

### Multiple patches

Reuse release-base branch for additional patches on same major.minor:

1. Push more fixes
2. Run build-patch-release.yml (auto-increments to v67.12.2, v67.12.3, etc.)

### Comparison: release paths

| Aspect | Normal | Patch | Emergency Pre-release |
|--------|--------|-------|----------------------|
| Source | develop | release-base/vX.Y.x | Any git ref |
| Timeline | Wed | Hours | ~5 min |
| Version | X.Y+1.0 | X.Y.Z+1 | Nightly format |
| Stable? | After baking | Immediate | Pre-release only |
| Workflows | promote → build-release | create-patch → build-patch | build-release + promote-prerelease |
| Cherry-pick | — | Required | Optional |
| Use case | Regular cycle | Formal patch | Hotfix → marketplace NOW |

## Troubleshooting

- 401 errors? Update VSCE PAT: https://salesforce.quip.com/E8GWA5TuI8jp

## Post-Publishing

1. Update Extension Pack: Extensions tab → Salesforce Extension Pack → update, or download from [marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode). (May take min to register.)
2. Restart VS Code
3. Validate: extensions running, commands work
4. Post announcement in #platform-dev-tools

---

# Publishing a Beta Pre-Release

High-risk changes → pre-release for early testing. VSIX artifacts → GitHub release (no npm/marketplace yet).

**Steps:**

1. Create release branch, bump version per `create-release-branch.js`
2. Format: keep minor, patch = `YYYYMMDDHHMM` (e.g., v55.11.202208260522)
3. Push to remote
4. Actions → 'Publish Beta Release to GitHub Only' workflow
5. **Run Workflow** from beta branch
6. Creates git tag, release, VSIX files for download/test

**Note:** Beta branch (unique versioning) → do NOT merge to develop. Use regular release when ready.

---

# Tips: Make Extension Publishable

Add to `extensionDependencies` in `packages/salesforcedx-vscode/package.json`.

In extension's `package.json`:
- `bugs`: `https://github.com/forcedotcom/salesforcedx-vscode/issues`
- `repository`: `https://github.com/forcedotcom/salesforcedx-vscode`

Add scripts:
- Modern: wireit ([Build](../docs/Build.md), [vsce-direct-use](../docs/adr/0017-vsce-package-directly.md))
- Legacy: `vscode:prepublish`, `vscode:package:legacy`
- All need: `vscode:sha256`, `vscode:publish`

Add to `package.json`: `engines.vscode`, `publisher`, `categories` — auto-discovered by nightly builds via [`list-vscode-extensions.js`](../scripts/list-vscode-extensions.js) (main first, then alphabetical; no workflow updates).

[publish_vscode_ext]: https://code.visualstudio.com/docs/extensions/publish-extension
