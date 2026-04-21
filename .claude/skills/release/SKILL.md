---
name: release
description: Run the VS Code extension release workflow end-to-end. Use when publishing a release, running prerelease, verifying the release branch, polishing changelog for release, or installing release vsixes for verification.
---

# Release Workflow

Full doc: [contributing/publishing.md](../../../contributing/publishing.md)

## Scripts in this skill

Run from repo root via `ts-node`:

- `ts-node .claude/skills/release/detect-state.ts` — outputs JSON with `currentRelease`, `version`, `priorRelease`, `tagExists`, `onReleaseBranch`, `commitCount`, `branchUrl`, `compareUrl`
- `ts-node .claude/skills/release/slack-post.ts [--version X.Y.Z]` — outputs Slack mrkdwn to stdout

## Step 0 — Verify release branch

Run `detect-state.ts` first to capture all context for subsequent steps.

Check that the scheduled `createReleaseBranch.yml` ran:

```sh
gh run list --workflow=createReleaseBranch.yml -L 5 --repo forcedotcom/salesforcedx-vscode
```

Report status + timestamp. If no run exists this week or user requests a patch:

```sh
gh workflow run createReleaseBranch.yml -f releaseType=patch --repo forcedotcom/salesforcedx-vscode
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
ts-node .claude/skills/release/slack-post.ts
```

Capture stdout and print inside a fenced code block for copy-paste into `#platform-dev-tools`.

## Conventions

- All `gh` commands include `--repo forcedotcom/salesforcedx-vscode`
- Never push to a release branch without explicit user approval of the diff
- Never dispatch `prerelease.yml` without explicit user signal
