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

Automated workflow [`buildReleaseFromPrerelease.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/buildReleaseFromPrerelease.yml) (Mon 8 AM UTC) → GitHub pre-release w/ VSIX + SHA256. Runs after 5-day baking period (Wed pre-release → Mon stable). Trigger manually for on-demand.

**Inputs:**
- `startFromRef` — git ref (tag/branch/SHA) to build from (optional)
- `prereleaseTag` — prerelease tag e.g. `v67.11.1-nightly.develop.20260812` (auto-detect if empty)
- `releaseVersion` — e.g. `67.12.0` (auto-calculated if empty)

**Detection priority:** `startFromRef` → `prereleaseTag` → auto-detect latest promoted nightly

**Use `startFromRef` for emergency scenarios:**
- Build from hotfix branch: `-f startFromRef="hotfix/security-fix"`
- Build from specific commit: `-f startFromRef="abc123def456"`
- Build from old tag: `-f startFromRef="v67.11.0-nightly.develop.20260805"`

**Examples:**

```sh
# Standard: auto-detect latest promoted prerelease
gh workflow run buildReleaseFromPrerelease.yml

# Emergency: build from hotfix branch
gh workflow run buildReleaseFromPrerelease.yml \
  -f startFromRef="hotfix/security-fix" \
  -f releaseVersion="67.12.1"

# Emergency: build from specific commit
gh workflow run buildReleaseFromPrerelease.yml \
  -f startFromRef="abc123def" \
  -f releaseVersion="67.12.1"

# Legacy: specify prerelease tag explicitly
gh workflow run buildReleaseFromPrerelease.yml \
  -f prereleaseTag="v67.11.1-nightly.develop.20260812"
```

**Scripts:**
- [`calculate-release-version.js`](../scripts/calculate-release-version.js) — extract prerelease, bump minor, or override; validates semver + bounds (max 9999)
- [`update-release-versions.js`](../scripts/update-release-versions.js) — update all publishable `package.json` + `package-lock.json`

**Security measures:**
- Command injection protection — regex validates tag format `v{major}.{minor}.{patch}-nightly.develop.{YYYYMMDD}`
- VSIX validation — confirms ≥1 VSIX created after build
- Script integrity — SHA256 checksums verify scripts weren't tampered (preserved/restored across tag checkout)
- Deletion timeout — fails if cleanup exceeds 20s (GitHub API eventual consistency)

Test locally; trigger `publishVSCode.yml` if tests pass.

## Nightly Builds & Pre-release Promotion

**Nightly builds:** `nightly.yml` → all extensions to pre-release daily (4 AM UTC) + on-demand. Auto-discovers via [`list-vscode-extensions.js`](../scripts/list-vscode-extensions.js).

**Wed pre-release promotion:** `promote-prerelease.yml` (Wed 7 AM UTC) → nightly tags ≥7 days old + passing CI to pre-release. Enables 5+ days customer testing.

**Mon stable release:** `buildReleaseFromPrerelease.yml` (Mon 8 AM UTC) → detects promoted Wed tag, builds stable VSIXs (5-day baking). Release engineer approves + publishes.

**Artifact retention:** 30 days (vs. 5 for PR builds).

## Publishing to Marketplace

### Standard Path: Nightly → Wed Pre-release → Mon Stable → Marketplace

1. **Wed 7 AM UTC:** `promote-prerelease.yml` auto-runs → promotes nightly tag ≥7 days old + passing CI to pre-release (customer testing begins)
2. **Wed–Mon:** ~5 days baking (customer validation)
3. **Mon 8 AM UTC:** `buildReleaseFromPrerelease.yml` auto-runs → detects promoted tag, builds stable VSIXs
4. Download + test VSIX files from GitHub pre-release
5. Trigger [`publishVSCode.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/publishVSCode.yml) w/ version (e.g. `67.12.0`)
6. Approve marketplace publish gates
7. Marketplace updates within min

### Merge to main (Automated)

`main` merge triggers [testBuildAndRelease](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/testBuildAndRelease.yml):
- Tests, build VSIXs, git tag + GitHub release, Slack notification

Then auto-triggers `publishVSCode.yml` when release marked "released" (not pre-release).

**Before approval:** Download + test VSIX locally:

```sh
gh release download v64.8.0 --dir ~/Downloads/v64.8.0 --pattern '*.vsix' --repo forcedotcom/salesforcedx-vscode
find ~/Downloads/v64.8.0 -type f -name "*.vsix" -exec code --install-extension {} \;
```

After testing, approve "Publish in Microsoft Marketplace" + "Publish in Open VSX Registry" jobs.

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

## Emergency Patch Releases

Critical hotfixes bypass normal cycle.

### When to use

- Security vulnerabilities
- Critical production bugs
- Showstoppers

### Steps

**1. Create release-base branch**

```sh
gh workflow run create-patch-release-branch.yml -f baseVersion="67.12.0" --repo forcedotcom/salesforcedx-vscode
```

Creates `release-base/v67.12.x` from tag. See [`create-patch-release-branch.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/create-patch-release-branch.yml).

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

Auto-calculates patch version, tags, builds VSIX.

**4. Test VSIX**

```sh
gh release download v67.12.1 --dir ~/Downloads/v67.12.1 --pattern '*.vsix' --repo forcedotcom/salesforcedx-vscode
find ~/Downloads/v67.12.1 -type f -name "*.vsix" -exec code --install-extension {} \;
```

**5. Publish**

```sh
gh workflow run publishVSCode.yml -f releaseVersion="67.12.1" --repo forcedotcom/salesforcedx-vscode
```

**6. Cherry-pick to develop**

Merge fixes back for future releases (commands in release notes).

```sh
git checkout develop && git pull origin develop
git cherry-pick <commit-sha>
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

### Comparison: patch vs. normal release

| Aspect | Normal | Patch |
|--------|--------|-------|
| Source | develop | release-base/vX.Y.x |
| Timeline | Wed → 5d → Mon | Hours |
| Version | X.Y+1.0 | X.Y.Z+1 |
| Workflows | promote-prerelease → buildReleaseFromPrerelease | create-patch-release-branch → build-patch-release |
| Cherry-pick | — | Required |
| Use case | Regular features/fixes | Emergencies |

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

# Manual Publish

Steps in associated GitHub Actions.

## Major Release Versioning

Versioning mapped to Salesforce Core: e.g., 53.0 → 54.0 bump.

## Downloading VSIX from GitHub Action

**Options:**
- GitHub Actions run → summary screen → artifacts
- `gh run download --dir /path 3746978326` (job ID from UI or `gh run list`)

**Manual install:**
- `code --install-extension /path/to.vsix`
- `find ./vsix -type f -name "*.vsix" -exec code --install-extension {} \;`

## Generating SHA256

VSIX files unsigned/unverified ([vscode-vsce#191](https://github.com/Microsoft/vscode-vsce/issues/191)). SHA256 checksums verify integrity.

**Steps:**
1. `npm run vscode:sha256` → compute SHA256 for built VSIX
2. Append to top-level SHA256 file
3. Commit to git

## Publishing VSIX to Marketplace

**Prerequisites:**
- VSCE PAT exported as `VSCE_PERSONAL_ACCESS_TOKEN` ([Publishing VS Code Extensions][publish_vscode_ext])
- vsce installed + configured w/ Salesforce publisher
- Verify access: `vsce login (publisher name)`

**Steps:**
1. `npm run vscode:publish` → upload pre-built VSIX

**Critical:** Publish the same VSIX (don't repackage) so SHA256 checksums match.

## Merge Release Branch Back

**After:** Artifacts published.

See [Atlassian gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows#gitflow-workflow). Manual due to merge conflicts.

```sh
git checkout main && git pull
git merge release/vxx.y.z && git push
git checkout develop && git pull
git merge release/vxx.y.z && git push
```

## Manual Publish in Open VSX

**Option 1: Web UI**
1. Log in [Open VSX](https://open-vsx.org/) w/ svc-idee-bot GitHub account
2. Settings → Account avatar
3. Extensions → publish extensions → drag + drop VSIX

**Option 2: CLI**
1. Get publish token from LastPass shared folder
2. `npx ovsx publish <vsix-file> -p <token>`

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
