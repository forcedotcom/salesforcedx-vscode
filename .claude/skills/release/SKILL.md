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

## Step 0 — Verify Wednesday stable build

Run `detect-state.ts` first.

> **Note:** `createReleaseBranch.yml` deprecated — use `build-release.yml`. Old workflow scheduled for deletion after proven stability (W-23988524).

Check scheduled `build-release.yml` ran Wednesday:

```sh
gh run list --workflow=build-release.yml -L 5 --repo forcedotcom/salesforcedx-vscode
```

Report status + timestamp. On **failure**, inspect logs:

```sh
gh run view <runId> --repo forcedotcom/salesforcedx-vscode
```

Decision matrix:

- **Build succeeded** → GitHub pre-release created w/ VSIX + SHA256. Continue to Step 1.
- **Build failed** → check logs. Issues: no promoted tag (wait Wed 7 AM UTC) or build script error. Re-run:
  ```sh
  gh workflow run build-release.yml --repo forcedotcom/salesforcedx-vscode
  ```
- **No run this week** → Either:
  - Wait (Wed 8 AM UTC)
  - Trigger manually:
  ```sh
  gh workflow run build-release.yml --repo forcedotcom/salesforcedx-vscode
  ```

After re-dispatch, watch until complete:

```sh
gh run list --workflow=build-release.yml -L 1 --json databaseId --repo forcedotcom/salesforcedx-vscode
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

## Step 1 — Download stable release build

Get VSIX + SHA256 from GitHub pre-release created by `build-release.yml`. Release notes link to [docs/release-testing-guide.md](../../../docs/release-testing-guide.md) for full testing/publishing instructions:

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

- **Daily 4 AM UTC** — nightly.yml → extensions as prerelease
- **Wed 7 AM UTC** — promote-prerelease.yml → selects nightly, gate-checks CI, promotes to pre-release; creates `marketplace-prerelease-*` tracking tag
- **Wed 8 AM UTC** — build-release.yml → auto-detects promoted tag, builds stable VSIXs (or emergency pre-release w/ publishAsPrerelease flag)
- **After test approval** — publishVSCode.yml → publishes to Microsoft + Open VSX


## Emergency Hotfixes

For critical security/production bugs, use the separate **`/patch-release`** skill.

See [patch-release/SKILL.md](../patch-release/SKILL.md) for emergency patch release workflow.

## Conventions

- All `gh` commands use `--repo forcedotcom/salesforcedx-vscode`
- Don't approve publishes until manual testing done
- Patch releases bypass timeline for emergencies only
- Always cherry-pick fixes to develop after publishing
