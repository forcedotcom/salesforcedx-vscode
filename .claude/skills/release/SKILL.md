---
name: release
description: Run the VS Code extension release workflow end-to-end. Use when publishing a release, running prerelease, verifying the release branch, polishing changelog for release, or installing release vsixes for verification.
---

# Release Workflow

Full doc: [contributing/publishing.md](../../../contributing/publishing.md)

## Scripts in this skill

Run from repo root via `npx ts-node` (no global `ts-node`):

- `npx ts-node .claude/skills/release/detect-state.ts` — outputs JSON with `currentRelease`, `version`, `priorRelease`, `tagExists`, `onReleaseBranch`, `commitCount`, `branchUrl`, `compareUrl`

## Step 0 — Verify release branch

Run `detect-state.ts` first to capture all context for subsequent steps.

Check that the scheduled `createReleaseBranch.yml` ran:

```sh
gh run list --workflow=createReleaseBranch.yml -L 5 --repo forcedotcom/salesforcedx-vscode
```

Report status + timestamp. If the top-level run shows **failure**, inspect jobs — the workflow has two: `Create Branch` then `Trigger Generate Changelog Workflow`:

```sh
gh run view <runId> --repo forcedotcom/salesforcedx-vscode
```

Decision matrix:

- **Both jobs succeeded** → continue to Step 1
- **`Create Branch` failed** → branch never created. Re-run with default (minor):
  ```sh
  gh workflow run createReleaseBranch.yml -f releaseType=minor --repo forcedotcom/salesforcedx-vscode
  ```
- **`Create Branch` succeeded but `Generate Changelog` failed** → partial state: branch exists on remote but CHANGELOG is not updated for the new version. Recovery: delete the broken branch, then re-dispatch the workflow. Confirm no open PRs first.
  ```sh
  gh pr list --state open --head release/v<version> --repo forcedotcom/salesforcedx-vscode
  git push origin --delete release/v<version>
  gh workflow run createReleaseBranch.yml -f releaseType=minor --repo forcedotcom/salesforcedx-vscode
  ```
- **No run this week** → re-run with default (minor), same command as above
- **User explicitly requests patch** (code changes landed after branch cut) → run with patch:
  ```sh
  gh workflow run createReleaseBranch.yml -f releaseType=patch --repo forcedotcom/salesforcedx-vscode
  ```

After any re-dispatch, watch the new run until it completes before Step 1:

```sh
gh run list --workflow=createReleaseBranch.yml -L 1 --json databaseId --repo forcedotcom/salesforcedx-vscode
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

## Step 1 — Show release branch link

Print `branchUrl` from `detect-state.ts`.

## Step 2 — Show changes

Print `compareUrl` and `commitCount` from `detect-state.ts` so user can review what's in this release without leaving the chat.

## Step 3-4 — Polish changelog

Check out the release branch:

```sh
git fetch origin && git checkout <currentRelease> && git pull
```

Read and follow [.claude/skills/changelog/SKILL.md](../changelog/SKILL.md) to polish `packages/salesforcedx-vscode/CHANGELOG.md`.

**Verify the release date.** The auto-generated header uses `today + 2 days` (see `scripts/change-log-generator-utils.js` `getReleaseDate`). This assumes a Monday branch-cut → Wednesday release. Releases always ship on Wednesday, even for re-runs or patches. If the header date is not the upcoming Wednesday, fix it and confirm the target date with the user before committing.

Show `git diff packages/salesforcedx-vscode/CHANGELOG.md` to user.

**Wait for explicit "approved" before proceeding.**

After approval:

```sh
git add packages/salesforcedx-vscode/CHANGELOG.md && git commit -m 'chore: polish changelog' && git push
```

After pushing, print a link to the rendered CHANGELOG on the branch so the user can share it with the team. Format:

```
https://github.com/forcedotcom/salesforcedx-vscode/blob/<currentRelease>/packages/salesforcedx-vscode/CHANGELOG.md
```

## Step 5 — Wait for team approval

Stop here. Tell the user: "Let me know when the team has approved the changelog and you're ready to run PreRelease."

Do not proceed until user says so.

## Step 6 — Run PreRelease workflow

Dispatch when user signals approval:

```sh
gh workflow run prerelease.yml \
  -f releaseBranch=<currentRelease> \
  --ref develop \
  --repo forcedotcom/salesforcedx-vscode
```

Capture the run:

```sh
gh run list --workflow=prerelease.yml -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
```

Monitor until complete:

```sh
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

## Step 7 — Monitor build and release

After PreRelease succeeds, the merge into `main` triggers `testBuildAndRelease.yml`. Monitor it:

```sh
gh run list --workflow=testBuildAndRelease.yml -L 1 --json databaseId --repo forcedotcom/salesforcedx-vscode
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

Confirm the release tag was created:

```sh
gh release view v<version> --repo forcedotcom/salesforcedx-vscode
```

## Step 8 — Download and install vsixes

Ask user: `code` or `code-insiders`? (default `code`)

```sh
gh release download v<version> \
  --dir ~/Downloads/v<version> \
  --pattern '*.vsix' \
  --repo forcedotcom/salesforcedx-vscode

find ~/Downloads/v<version> -type f -name "*.vsix" -exec <binary> --install-extension {} \;
```

User should reload VS Code and run a few commands to validate.

## Step 9 — Confirm manual testing is complete

### 9a — Create the Slack testing canvas

The testing doc is a Slack canvas (no longer Quip). The template lives at https://salesforce.enterprise.slack.com/docs/T092Z56AE/F0B7RLRUSRG (canvas id `F0B7RLRUSRG`).

**If Slack MCP is available**: create the per-release canvas directly.

1. Read the template: `slack_read_canvas` with `canvas_id: F0B7RLRUSRG`.
2. Create the new canvas with `slack_create_canvas`, title **Release Testing v\<version\>** (e.g. `Release Testing v66.15.0`), where `<version>` matches the GH release tag (`gh release view v<version>` in Step 7, or `detect-state.ts` `version`).
3. Copy the template body, bumping the `Release Version` line and any version-specific section headers to `v<version>`. Drop the trailing image-based "Instructions"/"Org picker" sections — Slack file-image refs (`![...][img-...]`) don't transfer across canvases, so they render broken; the instruction links in the template remain the reference.
4. Print the returned `canvas_url` to the user.

**If Slack MCP is not available**: tell the user to copy the [template canvas](https://salesforce.enterprise.slack.com/docs/T092Z56AE/F0B7RLRUSRG) into a new canvas named **Release Testing v\<version\>** and share it with the team.

Wait for the user to confirm the doc is ready before continuing.

### 9b — Run smoke checks

Tell the user: "Let me know when you've finished manually testing the installed vsixes (logged in the testing canvas) and you're ready to publish to the Microsoft Marketplace and Open VSX."

Suggested smoke checks the user may run before confirming:

- Authorize an org / set a default org
- Deploy and retrieve metadata
- Run an Apex test from the Test Explorer
- Open SOQL Builder and run a query
- Open the Org Browser

Do not proceed until the user explicitly confirms testing is complete.

## Step 10 — Approve marketplace publishes

After the GitHub Release is created in Step 7, `publishVSCode.yml` (Microsoft Marketplace) and `publishOpenVSX.yml` (Open VSX) auto-trigger on the `release: [released]` event. Both are gated by the `publish` GitHub Environment and wait for manual approval.

Once the user confirms readiness in Step 9, list the pending runs:

```sh
gh run list --workflow=publishVSCode.yml -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
gh run list --workflow=publishOpenVSX.yml -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
```

Print both run URLs and tell the user to approve each pending deployment in the GitHub UI (Actions → run → Review pending deployments → Approve and deploy). Approval cannot be performed by the same identity that triggered the run, so the user must do this themselves.

After approval, monitor each run to completion:

```sh
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

Verify the extensions are live before continuing:

- Microsoft Marketplace: https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode
- Open VSX: https://open-vsx.org/extension/salesforce/salesforcedx-vscode

## Step 11 — Slack post

Compose the post from `packages/salesforcedx-vscode/CHANGELOG.md` (top section). Format:

- Header: `*Salesforce Extensions for VS Code v<version> is out* :tada:`
- Marketplace link: `<https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode|VS Code Marketplace>` — note "see the *Changelog* tab for full details"
- Sections: `*Added*` / `*Fixed*` (from `## Added` / `## Fixed`)
- Subsection headers (`#### foo`) → blockquote (`> foo`)
- Bullets: drop ` ([PR #N](url), [ISSUE #N](url))` trailers

Show the composed post to the user in a fenced code block.

**If Slack MCP is available**: offer to post or draft to `#platform-dev-tools`. Wait for explicit approval or change feedback before calling `slack_send_message` / `slack_send_message_draft`.

**If not**: user copy-pastes manually.

## Conventions

- All `gh` commands include `--repo forcedotcom/salesforcedx-vscode`
- Never push to a release branch without explicit user approval of the diff
- Never dispatch `prerelease.yml` without explicit user signal
- Never instruct the user to approve marketplace publishes until they confirm manual testing of the installed vsixes is complete
