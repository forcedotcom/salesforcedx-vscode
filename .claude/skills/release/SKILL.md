---
name: release
description: Run the VS Code extension release workflow end-to-end. Use when publishing a release, running prerelease, verifying the release branch, polishing changelog for release, or installing release vsixes for verification.
---

# Release Workflow

Full doc: [contributing/publishing.md](../../../contributing/publishing.md)

## Scripts in this skill

Run from repo root via `npx ts-node` (no global `ts-node`):

- `npx ts-node .claude/skills/release/detect-state.ts` — outputs JSON with `currentRelease`, `version`, `priorRelease`, `tagExists`, `onReleaseBranch`, `commitCount`, `branchUrl`, `compareUrl`
- `npx ts-node .claude/skills/release/slack-post.ts [--version X.Y.Z]` — outputs Slack mrkdwn to stdout

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

## Step 9 — Generate Slack post

Run from repo root:

```sh
npx ts-node .claude/skills/release/slack-post.ts
```

Capture stdout and print inside a fenced code block for copy-paste into `#platform-dev-tools`.

## Conventions

- All `gh` commands include `--repo forcedotcom/salesforcedx-vscode`
- Never push to a release branch without explicit user approval of the diff
- Never dispatch `prerelease.yml` without explicit user signal
