---
name: release
description: Run the VS Code extension release workflow end-to-end. Use when publishing a release, running prerelease, verifying the release branch, polishing changelog for release, or installing release vsixes for verification.
review: never
---

# Release Workflow

Full doc: [contributing/publishing.md](../../../contributing/publishing.md)

## Step 1 — Download stable release build

Get VSIX + SHA256 from GitHub pre-release created by `build-github-release.yml`. Release notes link to [docs/release-testing-guide.md](../../../docs/release-testing-guide.md) for full testing/publishing instructions:

```sh
gh release list --repo forcedotcom/salesforcedx-vscode | head -5
gh release download v<version> \
  --dir ~/Downloads/v<version> \
  --pattern '*.vsix' \
  --repo forcedotcom/salesforcedx-vscode
```

## Step 2 — Install and test locally

Ask user: `code` or `code-insiders`? (default `code`)

```sh
find ~/Downloads/v<version> -type f -name "*.vsix" -exec <binary> --install-extension {} \;
```

User should reload VS Code and run a few commands to validate.

## Step 3 — Confirm manual testing is complete

### 3a — Create the Slack testing doc

The user creates the testing doc from the team's Slack template: https://salesforce.enterprise.slack.com/docs/T092Z56AE/F0B7RLRUSRG

> Create a new doc from the Slack template and name it **Release Testing v\<version\>** (e.g. `Release Testing v67.12.0`), where `<version>` matches the GH release tag.

Use the version from Step 1. Wait for the user to confirm the doc is created and shared with the team before continuing.

### 3b — Run smoke checks

Tell the user: "Let me know when you've finished manually testing the installed vsixes (logged in the Slack doc) and you're ready to publish to the Microsoft Marketplace and Open VSX."

Suggested smoke checks the user may run before confirming:

- Authorize an org / set a default org
- Deploy and retrieve metadata
- Run an Apex test from the Test Explorer
- Open SOQL Builder and run a query
- Open the Org Browser

Do not proceed until the user explicitly confirms testing is complete.

## Step 4 — Promote the release, then trigger marketplace publish

Once user confirms testing is complete, first promote the GitHub release from pre-release to a full release — this is the actual "make it stable" signal, and it's required before `vsce publish` will accept the VSIX. The publish pipeline reads the release's `isPrerelease` flag and passes `--pre-release` to `vsce` whenever it's still `true`; that fails outright since these VSIXs were packaged as stable (`Cannot use '--pre-release' flag with a package that was not packaged as pre-release`):

```sh
gh release edit v<version> --prerelease=false --repo forcedotcom/salesforcedx-vscode
```

Flip auto-fires both workflows via `on.release.types: [released]` ([`publishVSCode.yml`](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/.github/workflows/publishVSCode.yml), [`publishOpenVSX.yml`](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/.github/workflows/publishOpenVSX.yml)):

- `publish` → `vscode-publish-release-vsix.yml` with `release-tag` = that tag (VSIXs on the GH release)
- `prepare-release-metadata` checks out `ref: develop` only to compare tags + set Code Builder / GUS patch-vs-minor metadata — does **not** publish develop's tree
- Open VSX checks out `$RELEASE_TAG`

Both still need `publish` environment approval. Manual `workflow_dispatch` = retry only.

Dispatch **both** [`publishVSCode.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/publishVSCode.yml) and [`publishOpenVSX.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/publishOpenVSX.yml) — dispatching one does **not** trigger the other (verified against run history: manual dispatches always appear as two separate `workflow_dispatch` runs, never a cascade). Use the tag form (`v<version>`, e.g. `v67.12.0`):

```sh
gh workflow run publishVSCode.yml  -f version="v<version>"      --repo forcedotcom/salesforcedx-vscode
gh workflow run publishOpenVSX.yml -f release-tag="v<version>" --repo forcedotcom/salesforcedx-vscode
```

Both gated by the `publish` environment — user will approve **each** run in GitHub UI (Actions → run → Review pending → Approve + deploy).

Tell user: "Triggered both publish workflows (Marketplace + Open VSX). You'll need to approve the environment gate on each in GitHub Actions UI."

Monitor runs:

```sh
gh run list --workflow=publishVSCode.yml  -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
gh run list --workflow=publishOpenVSX.yml -L 1 --json databaseId,status,url --repo forcedotcom/salesforcedx-vscode
gh run watch <databaseId> --repo forcedotcom/salesforcedx-vscode
```

Verify live:

- [Microsoft Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode)
- [Open VSX](https://open-vsx.org/extension/salesforce/salesforcedx-vscode)

## Step 5 — Slack post

Compose from `packages/salesforcedx-vscode/CHANGELOG.md` (top section). Format:

- Header: `*Salesforce Extensions for VS Code v<version> is out* :tada:`
- Link: bare URL on its own line — `VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode` (see *Changelog* tab for full details). Do **not** use Slack's `<url|text>` bracket-pipe syntax: anything outside Slack's own composer (chat clients, clipboards, other markdown renderers) tends to do naive URL auto-detection, grabs everything up to the next whitespace, and mangles the link — encoding the `|` as `%7C` and swallowing the leading text into the URL.
- Sections: `*Added*` / `*Fixed*`
- Subsections (`#### foo`) → blockquote (`> foo`)
- Drop PR/issue trailers

Show composed post. If Slack MCP available → offer to post/draft to `#platform-dev-tools`. Wait for approval before sending.

## Emergency Hotfixes

For critical security/production bugs, use the separate **`/patch-release`** skill.

See [patch-release/SKILL.md](../patch-release/SKILL.md) for emergency patch release workflow.

## Conventions

- All `gh` commands use `--repo forcedotcom/salesforcedx-vscode`
- Don't approve publishes until manual testing done
- Patch releases bypass timeline for emergencies only
- Always cherry-pick fixes to develop after publishing
