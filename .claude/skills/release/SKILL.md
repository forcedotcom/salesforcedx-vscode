---
name: release
description: Run the VS Code extension release workflow end-to-end. Use when publishing a release, running prerelease, verifying the release branch, polishing changelog for release, or installing release vsixes for verification.
review: never
---

# Release Workflow

Full doc: [contributing/publishing.md](../../../contributing/publishing.md)

## Scripts in this skill

From repo root (no global `ts-node`):

- `npx ts-node .claude/skills/release/detect-state.ts` — outputs JSON with `currentRelease`, `version`, `priorRelease`, `tagExists`, `onReleaseBranch`, `commitCount`, `branchUrl`, `compareUrl`

## Step 0 — Verify Monday stable build

Run `detect-state.ts` first.

Check scheduled `buildReleaseFromPrerelease.yml` ran Monday:

```sh
gh run list --workflow=buildReleaseFromPrerelease.yml -L 5 --repo forcedotcom/salesforcedx-vscode
```

Report status + timestamp. On **failure**, inspect logs:

```sh
gh run view <runId> --repo forcedotcom/salesforcedx-vscode
```

Decision matrix:

- **Build succeeded** → GitHub pre-release created w/ VSIX + SHA256. Continue to Step 1.
- **Build failed** → check logs. Issues: no promoted tag (wait Wed 7 AM UTC) or build script error. Re-run:
  ```sh
  gh workflow run buildReleaseFromPrerelease.yml --repo forcedotcom/salesforcedx-vscode
  ```
- **No run this week** → Either:
  - Wait (Mon 8 AM UTC)
  - Trigger manually:
  ```sh
  gh workflow run buildReleaseFromPrerelease.yml --repo forcedotcom/salesforcedx-vscode
  ```

After re-dispatch, watch until complete:

```sh
gh run list --workflow=buildReleaseFromPrerelease.yml -L 1 --json databaseId --repo forcedotcom/salesforcedx-vscode
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

## Step 1 — Download stable release build

Get VSIX + SHA256 from GitHub pre-release created by `buildReleaseFromPrerelease.yml`:

```sh
gh release list --repo forcedotcom/salesforcedx-vscode | head -5
gh release download v<version> \
  --dir ~/Downloads/v<version> \
  --pattern '*.vsix' \
  --repo forcedotcom/salesforcedx-vscode
```

## Step 2 — Install and test locally

Ask: `code` or `code-insiders`? (default `code`)

```sh
find ~/Downloads/v<version> -type f -name "*.vsix" -exec <binary> --install-extension {} \;
```

Reload VS Code, run smoke checks.

## Step 3 — Confirm manual testing is complete

Tell user: "Log testing in Slack, confirm when ready to publish."

Suggested smoke checks:

- Authorize org / set default
- Deploy + retrieve metadata
- Run Apex test from Test Explorer
- Open SOQL Builder, run query
- Open Org Browser

Don't proceed until user confirms testing done.

## Step 4 — Approve marketplace publishes

Trigger [`publishVSCode.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/publishVSCode.yml) with version (e.g., `67.12.0`):

```sh
gh workflow run publishVSCode.yml -f releaseVersion=<version> --repo forcedotcom/salesforcedx-vscode
```

Triggers `publishOpenVSX.yml`. Both gated by `publish` environment — approve in GitHub UI (Actions → run → Review pending → Approve + deploy).

Monitor runs:

```sh
gh run list --workflow=publishVSCode.yml -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

Verify live:

- [Microsoft Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode)
- [Open VSX](https://open-vsx.org/extension/salesforce/salesforcedx-vscode)

## Step 5 — Slack post

Compose from `packages/salesforcedx-vscode/CHANGELOG.md` (top section). Format:

- Header: `*Salesforce Extensions for VS Code v<version> is out* :tada:`
- Link: `<https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode|VS Code Marketplace>` → "see *Changelog* tab"
- Sections: `*Added*` / `*Fixed*`
- Subsections (`#### foo`) → blockquote (`> foo`)
- Drop PR/issue trailers

Show composed post. If Slack MCP available → offer to post/draft to `#platform-dev-tools`. Wait for approval before sending.

## Release timeline

- **Daily 4 AM UTC** — nightly.yml → all extensions as prerelease
- **Wed 7 AM UTC** — promote-prerelease.yml → promotes latest nightly (passing E2E), creates `marketplace-prerelease-*` tracking tag
- **5-day baking** — Wed → Mon (customer validation)
- **Mon 8 AM UTC** — buildReleaseFromPrerelease.yml → auto-detects promoted tag, builds stable VSIXs
- **After test approval** — publishVSCode.yml → publishes to Microsoft + Open VSX

## Emergency Patch Releases

Bypass normal cycle for critical hotfixes.

### When to use

- Security vulnerabilities
- Critical production bugs
- Showstoppers

### Steps

**1. Create release-base branch**

```sh
gh workflow run create-patch-release-branch.yml -f baseVersion="67.12.0" --repo forcedotcom/salesforcedx-vscode
```

Creates `release-base/v67.12.x` from tag; copies latest version helpers from develop.

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

Auto-calculates patch (stable tags only), tags exact commit, builds VSIX.

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

Merge fixes back. Release notes provide cherry-pick commands.

```sh
git checkout develop && git pull origin develop
git cherry-pick <commit-sha>  # functional fixes only
git push origin develop
```

**7. Cleanup**

```sh
git push origin --delete release-base/v67.12.x
```

### Multiple patches

Reuse release-base branch; run build-patch-release.yml (auto-increments v67.12.2, etc.)

## Alternative: Build from Arbitrary Ref

Emergency releases without formal branches use `buildReleaseFromPrerelease.yml` + `startFromRef`:

```sh
# Build from hotfix branch
gh workflow run buildReleaseFromPrerelease.yml \
  -f startFromRef="hotfix/security-fix" \
  -f releaseVersion="67.12.1" \
  --repo forcedotcom/salesforcedx-vscode

# Build from specific commit
gh workflow run buildReleaseFromPrerelease.yml \
  -f startFromRef="abc123def456" \
  -f releaseVersion="67.12.1" \
  --repo forcedotcom/salesforcedx-vscode

# Build from old prerelease tag
gh workflow run buildReleaseFromPrerelease.yml \
  -f startFromRef="v67.11.0-nightly.develop.20260805" \
  -f releaseVersion="67.12.1" \
  --repo forcedotcom/salesforcedx-vscode
```

**When to use:**
- Time-critical fixes without formal patch workflow
- Experimental branches for validation
- Historical commits
- Emergency without branch overhead

**Priority:** `startFromRef` → `prereleaseTag` → auto-detect latest nightly

## Conventions

- All `gh` commands use `--repo forcedotcom/salesforcedx-vscode`
- `createReleaseBranch.yml` deprecated (use buildReleaseFromPrerelease.yml)
- Don't approve publishes until manual testing done
- 5-day gap (Wed → Mon) intentional for validation
- Patch releases bypass timeline for emergencies only
- Always cherry-pick fixes to develop after publishing
