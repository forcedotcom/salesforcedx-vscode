---
name: release
description: Run the VS Code extension release workflow end-to-end. Use when publishing a release, running prerelease, verifying the release branch, polishing changelog for release, or installing release vsixes for verification.
---

# Release Workflow

Full doc: [contributing/publishing.md](../../../contributing/publishing.md)

## Scripts

From repo root via `npx ts-node` (no global `ts-node`):

- `npx ts-node .claude/skills/release/detect-state.ts` → JSON: `currentRelease`, `version`, `priorRelease`, `tagExists`, `onReleaseBranch`, `commitCount`, `branchUrl`, `compareUrl`

## Step 0 — Verify release branch

Run `detect-state.ts` first; captures context for all later steps.

Check scheduled `createReleaseBranch.yml` ran:

```sh
gh run list --workflow=createReleaseBranch.yml -L 5 --repo forcedotcom/salesforcedx-vscode
```

Report status + timestamp. On **failure**, inspect jobs — two: `Create Branch` then `Trigger Generate Changelog Workflow`:

```sh
gh run view <runId> --repo forcedotcom/salesforcedx-vscode
```

Decision matrix:

- **Both succeeded** → Step 1
- **`Create Branch` failed** → branch never created. Re-run (minor):
  ```sh
  gh workflow run createReleaseBranch.yml -f releaseType=minor --repo forcedotcom/salesforcedx-vscode
  ```
- **`Create Branch` ok, `Generate Changelog` failed** → partial: branch on remote, CHANGELOG not updated. Recovery: confirm no open PRs, delete branch, re-dispatch:
  ```sh
  gh pr list --state open --head release/v<version> --repo forcedotcom/salesforcedx-vscode
  git push origin --delete release/v<version>
  gh workflow run createReleaseBranch.yml -f releaseType=minor --repo forcedotcom/salesforcedx-vscode
  ```
- **No run this week** → re-run (minor), same command
- **User requests patch** (code landed after cut) → run with patch:
  ```sh
  gh workflow run createReleaseBranch.yml -f releaseType=patch --repo forcedotcom/salesforcedx-vscode
  ```

After any re-dispatch, watch to completion before Step 1:

```sh
gh run list --workflow=createReleaseBranch.yml -L 1 --json databaseId --repo forcedotcom/salesforcedx-vscode
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

## Step 1 — Show release branch link

Print `branchUrl`.

## Step 2 — Show changes

Print `compareUrl` + `commitCount` so user reviews the release in-chat.

## Step 3-4 — Polish changelog

Check out the branch:

```sh
git fetch origin && git checkout <currentRelease> && git pull
```

Follow [.claude/skills/changelog/SKILL.md](../changelog/SKILL.md) to polish `packages/salesforcedx-vscode/CHANGELOG.md`.

**Verify release date.** Auto-header uses `today + 2 days` (`scripts/change-log-generator-utils.js` `getReleaseDate`) — assumes Mon cut → Wed release. Releases always ship Wednesday, even re-runs/patches. If header date ≠ upcoming Wednesday, fix it and confirm target with user before committing.

Show `git diff packages/salesforcedx-vscode/CHANGELOG.md`.

**Wait for explicit "approved".**

After approval:

```sh
git add packages/salesforcedx-vscode/CHANGELOG.md && git commit -m 'chore: polish changelog' && git push
```

Then print rendered CHANGELOG link for the team:

```
https://github.com/forcedotcom/salesforcedx-vscode/blob/<currentRelease>/packages/salesforcedx-vscode/CHANGELOG.md
```

## Step 5 — Wait for team approval

Stop. Tell user: "Let me know when the team has approved the changelog and you're ready to run PreRelease."

Don't proceed until user says so.

## Step 6 — Run PreRelease workflow

Dispatch on user signal:

```sh
gh workflow run prerelease.yml \
  -f releaseBranch=<currentRelease> \
  --ref develop \
  --repo forcedotcom/salesforcedx-vscode
```

Capture run:

```sh
gh run list --workflow=prerelease.yml -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
```

Monitor:

```sh
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

## Step 7 — Monitor build and release

PreRelease merge into `main` triggers `testBuildAndRelease.yml`. Monitor:

```sh
gh run list --workflow=testBuildAndRelease.yml -L 1 --json databaseId --repo forcedotcom/salesforcedx-vscode
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

Confirm release tag:

```sh
gh release view v<version> --repo forcedotcom/salesforcedx-vscode
```

## Step 8 — Download and install vsixes

Ask: `code` or `code-insiders`? (default `code`)

```sh
gh release download v<version> \
  --dir ~/Downloads/v<version> \
  --pattern '*.vsix' \
  --repo forcedotcom/salesforcedx-vscode

find ~/Downloads/v<version> -type f -name "*.vsix" -exec <binary> --install-extension {} \;
```

User reloads VS Code, validates a few commands.

## Step 9 — Confirm manual testing is complete

### 9a — Create the Slack testing canvas

Testing doc is a Slack canvas (no longer Quip). Template: https://salesforce.enterprise.slack.com/docs/T092Z56AE/F0B7RLRUSRG (canvas id `F0B7RLRUSRG`).

**Slack MCP available** → create per-release canvas directly:

1. Read template: `slack_read_canvas` `canvas_id: F0B7RLRUSRG`.
2. `slack_create_canvas`, title **Release Testing v\<version\>** (e.g. `Release Testing v66.15.0`); `<version>` matches GH tag (`gh release view v<version>` or `detect-state.ts` `version`).
3. Copy template body; bump `Release Version` line + version-specific headers to `v<version>`. Drop trailing image-based "Instructions"/"Org picker" sections — Slack file-image refs (`![...][img-...]`) don't transfer across canvases (render broken); template's instruction links remain the reference.
4. Print returned `canvas_url`.

**Not available** → tell user to copy the [template canvas](https://salesforce.enterprise.slack.com/docs/T092Z56AE/F0B7RLRUSRG) into a new canvas named **Release Testing v\<version\>**, share with team.

Wait for user to confirm doc ready.

### 9b — Do the testing doc

Tell user: "Let me know when you've finished manually testing the installed vsixes (logged in the testing canvas) and you're ready to publish to the Microsoft Marketplace and Open VSX."

Don't proceed until user confirms testing complete.

## Step 10 — Approve marketplace publishes

GH Release (Step 7) auto-triggers `publishVSCode.yml` (MS Marketplace) + `publishOpenVSX.yml` (Open VSX) on `release: [released]`. Both gated by `publish` GitHub Environment, await manual approval.

On user readiness (Step 9), list pending runs:

```sh
gh run list --workflow=publishVSCode.yml -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
gh run list --workflow=publishOpenVSX.yml -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
```

Print both run URLs; user approves each pending deployment in GitHub UI (Actions → run → Review pending deployments → Approve and deploy). Approver ≠ triggerer, so user must do it.

After approval, monitor each:

```sh
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

Verify live before continuing:

- MS Marketplace: https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode
- Open VSX: https://open-vsx.org/extension/salesforce/salesforcedx-vscode

## Step 11 — Slack post

Compose from `packages/salesforcedx-vscode/CHANGELOG.md` (top section). Format:

- Header: `*Salesforce Extensions for VS Code v<version> is out* :tada:`
- Marketplace link: `<https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode|VS Code Marketplace>` — note "see the *Changelog* tab for full details"
- Sections: `*Added*` / `*Fixed*` (from `## Added` / `## Fixed`)
- Subsection headers (`#### foo`) → blockquote (`> foo`)
- Bullets: drop ` ([PR #N](url), [ISSUE #N](url))` trailers

Show composed post in a fenced code block.

**Slack MCP available** → offer to post/draft to `#platform-dev-tools`. Wait for explicit approval or change feedback before `slack_send_message` / `slack_send_message_draft`.

**Not available** → user copy-pastes manually.

## Conventions

- All `gh` commands include `--repo forcedotcom/salesforcedx-vscode`
- Never push to a release branch without explicit approval of the diff
- Never dispatch `prerelease.yml` without explicit user signal
- Never instruct user to approve marketplace publishes until they confirm manual testing of installed vsixes is complete
