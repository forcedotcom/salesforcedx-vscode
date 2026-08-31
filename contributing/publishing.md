# Publishing

> For an automated, agent-assisted walkthrough of these steps, see [.claude/skills/release/SKILL.md](../.claude/skills/release/SKILL.md).

This is a guide for publishing to the Visual Studio Code Marketplace and the Open VSX Registry. Most contributors will not need to worry about publishing. However, it might be worthwhile familiarizing yourself with the steps in case you need to share the extensions through the .vsix files.

# Goal

Bundle extensions under `/packages` as .vsix files, push to [VS Code Marketplace](https://marketplace.visualstudio.com/vscode) and [Open VSX Registry](https://open-vsx.org/).

References:
- [Publishing VS Code Extensions][publish_vscode_ext]
- [Managing Extensions](https://code.visualstudio.com/docs/editor/extension-gallery)
- [Publishing Extensions on Open VSX Registry](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)

# Prerequisites

1. Publisher is a part of the GitHub team 'IDE Experience'.

# Steps

## Build Release from Prerelease

Manual workflow [`buildReleaseFromPrerelease.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/buildReleaseFromPrerelease.yml) builds release VSIXs from promoted prerelease tags for internal testing. Auto-detects latest nightly tag and bumps minor version, or accepts manual overrides.

Inputs:
- `prereleaseTag`: promoted prerelease tag (e.g., `v67.11.1-nightly.develop.20260812`); auto-detect if empty
- `releaseVersion`: release version (e.g., `67.12.0`); auto-calculated if empty

Uses scripts:
- [`scripts/calculate-release-version.js`](../scripts/calculate-release-version.js) — extract prerelease version, bump minor, or use override
- [`scripts/update-release-versions.js`](../scripts/update-release-versions.js) — update all publishable packages' `package.json` + `package-lock.json`

Output: GitHub pre-release with VSIX artifacts + SHA256 checksums. Test locally; trigger `publishVSCode.yml` for marketplace publish if tests pass.

## Nightly Builds & Pre-release Promotion

### Nightly Builds

Automated nightly VS Code extension builds via `salesforcecli/github-workflows` shared CI.

**Automatic:** Daily 4 AM UTC publishes all extensions as prereleases. New extensions auto-included via dynamic discovery.

**Manual trigger:**
```bash
# Publish all (dynamically discovered)
gh workflow run nightly.yml

# Publish specific extensions only
gh workflow run nightly.yml -f extensions="salesforcedx-vscode-apex,salesforcedx-vscode-core"

# Dry-run (no publish)
gh workflow run nightly.yml -f dry-run=true
```

**Extension discovery:** Nightly builds use [`scripts/list-vscode-extensions.js`](../scripts/list-vscode-extensions.js) — scans `packages/` for VS Code extensions:
- Filters: `engines.vscode`, `publisher`, `categories`; name starts `salesforcedx-vscode` (includes main bundle)
- Returns comma-separated list (sorted)
- Auto-included without workflow changes

Published releases extract extension names from VSIX filenames in release assets via `gh release view` + `sed`. Supports stable (`-1.2.3.vsix`) and prerelease (`-1.2.3-beta.vsix`, `-1.2.3-nightly.1.vsix`) formats.

**Architecture:** `nightly.yml` delegates to shared reusable workflow:
- **Workflow**: `salesforcecli/github-workflows/.github/workflows/vscode-publish-extensions.yml@main`
- **Git Identity**: `get-git-identity` job queries `getGithubUserInfo` action; provides username/email to publish job
- **Scripts**: Downloaded at runtime (not stored locally)
- **Actions**: check-ci-status, calculate-artifact-name, publish-vsix

**Required secrets** (repo settings):
- `IDEE_GH_TOKEN` — GitHub token for version bumps/releases
- `VSCE_PERSONAL_ACCESS_TOKEN` — VS Code Marketplace
- `IDEE_OVSX_PAT` — Open VSX Registry

**Environment variables:**
- `VSCE_PRE_RELEASE=true` — Set by wireit in legacy extension packaging to pass `--pre-release` flag to vsce
  - Used by: salesforcedx-vscode-core, lwc, lightning, apex-debugger, apex-oas
  - Script: `scripts/vsce-bundled-extension.ts`

**Package scripts:**
- `package:packages` — Stable packaging (calls `vscode:package`)
- `package:packages:prerelease` — Prerelease packaging (calls `vscode:package:prerelease`)
  - Modern extensions: adds `--pre-release` flag to vsce
  - Legacy extensions: sets `VSCE_PRE_RELEASE=true` env var

### Pre-release Promotion

**Pre-release promotion:** `promote-prerelease.yml` (Wednesdays 7 AM UTC) runs 3-stage pipeline: (1) find-nightly selects oldest nightly ≥7 days; (2) gate-check verifies CI passed on nightly commit; (3) promote creates tracking tag for release flow. Safe rollback window before general release.

**Release build:** See [Build Release from Prerelease](#build-release-from-prerelease) above.

**Artifact retention:** 30 days (vs. 5 for PR builds) supports promotion workflow stability checks.

**Implementation details:** See [github-workflows](https://github.com/salesforcecli/github-workflows) and [apex-language-support scripts](https://github.com/forcedotcom/apex-language-support/tree/main/.github/scripts). This repo is a **consumer** of shared infrastructure — calls reusable workflow, scripts maintained externally.

## Publishing to Marketplace

### Standard Path: Promoted Prerelease → Release

1. Promoted nightly tag exists (see [Pre-release promotion](#nightly-builds--pre-release-promotion))
2. Trigger [`buildReleaseFromPrerelease.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/buildReleaseFromPrerelease.yml) to build release VSIXs
3. Download + test VSIX files from GitHub pre-release
4. Trigger [`publishVSCode.yml`](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/publishVSCode.yml) with version (e.g., `67.12.0`)
5. Approve marketplace publish gates
6. Marketplace updates (usually within minutes)

### Merge to main (Automated)

Merge to `main` triggers [testBuildAndRelease](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/testBuildAndRelease.yml):
- Run tests, build VSIXs, create git tag + GitHub release, send Slack notification

Then triggers `publishVSCode.yml` (auto-triggered when release marked "released" not pre-release).

Before approving marketplace publish, download VSIX files, install locally, verify functionality.

Use [gh cli](https://cli.github.com/) (replace `v64.8.0` with your tag; `code` → `code-insiders` as needed):

```sh
gh release download v64.8.0 --dir ~/Downloads/v64.8.0 --pattern '*.vsix' --repo forcedotcom/salesforcedx-vscode
find ~/Downloads/v64.8.0 -type f -name "*.vsix" -exec code --install-extension {} \;
```

After testing (per internal template), approve "Publish in Microsoft Marketplace" and "Publish in Open VSX Registry" jobs.

### Web Console Release

After extensions are published to the MS Marketplace, Web Console needs a new release so customers get the updated extensions. There are two paths:

**Automatic (default):** The `publishVSCode.yml` workflow extracts published extensions from release assets, then dispatches to `code-builder-web` via `repository_dispatch`. That workflow polls the marketplace until extensions are available at the new version, then triggers a Web Console release with auto-promote to production. No manual steps needed.

To disable the automatic trigger, set repo variable `CBW_TRIGGER_ENABLED=false` (Settings → Secrets and variables → Actions → Variables). Default (unset) enables the trigger.

**Manual (when auto-promote is broken or disabled):** If the automatic flow fails or is disabled, you need to manually release and promote Web Console after confirming extensions are live in the marketplace:

1. Go to the [release.yml](https://github.com/forcedotcom/code-builder-web/actions/workflows/release.yml) workflow in `code-builder-web`
2. Click **Run workflow** from the `main` branch
3. Set **release-type** to `patch` (or `minor` if the extension version bumped minor)
4. Set **auto-promote** to `prd`
5. Run the workflow — this builds, creates a new version, and dispatches `promote.yml` to sync to `/latest/` in production

If you need to promote without a new release (e.g., re-promoting an existing version), use the [promote.yml](https://github.com/forcedotcom/code-builder-web/actions/workflows/promote.yml) workflow directly and select the version to promote to `prd`.

Full details on the CBW release lifecycle, CDN caching, and rollback procedures are in [code-builder-web/docs/application-lifecycle.md](https://github.com/forcedotcom/code-builder-web/blob/main/docs/application-lifecycle.md).

## Closing Shipped GitHub Issues

After successful publish to MS Marketplace, the `closePendingReleaseIssues.yml` workflow automatically closes issues and discussions referenced in `CHANGELOG.md`. It parses the changelog for the current release version, extracts issue and discussion numbers, posts a comment with the release version, and closes any still-open items (leaving already-closed ones with the comment only). Trigger manually via **Close Pending Release Issues** workflow if needed.

After a release, run the [`/shipped-issues`](../.claude/skills/shipped-issues/SKILL.md) Claude skill to close open GitHub issues whose linked GUS work items are closed and whose issue numbers appear in the published `CHANGELOG.md`.

## Troubleshooting

- 401 errors on publish? You probably need to update the VSCE PAT. https://salesforce.quip.com/E8GWA5TuI8jp

## Post-Publishing the .vsix

1. Update the Salesforce Extension Pack to the version you just published. Either go to the Extensions tab, select Salesforce Extension pack, and update... or go to https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode, download the version you published, and install. The publish may take a few minutes to register in the marketplace.
2. Restart Visual Studio Code
3. Test & validate the application - verify all the extensions are running, and run a command or two.
4. Once validated, post an announcement in #platform-dev-tools

---

# Publishing a Beta Pre-Release

For high-risk or large-scale changes, publish a pre-release to allow advanced users to test early. VSIX artifacts uploaded to GitHub release (no NPM or VS Code Marketplace publish yet).

## Steps

1. Create release branch, increment version per `create-release-branch.js`
2. Version format: keep minor, set patch to `YYYYMMDDHHMM` (e.g., v55.11.202208260522)
3. Push to remote
4. GitHub Actions tab → 'Publish Beta Release to GitHub Only' workflow
5. Select 'Run Workflow' from beta branch (requires write access)
6. Workflow creates git tag, release, and attaches individual VSIX files for download/test

Note: beta branch (unique versioning) should not merge back to develop; use regular release process when ready.

---

# Manual Publish

The steps used to publish to the VS Code Marketplace can be found in the associated GitHub Actions.

## Generating a Major Release

The versioning we follow is intentionally mapped with Salesforce Core. When a major version bump occurs, such as 67.x -> 68.0, we release a major version update as well.

### Major Version Bump Process

Major bumps are aligned with Salesforce Core major version releases (e.g., SF CLI 2.x → 3.x).

**Step 1: Bump develop branch**

Create a PR to update `package.json` in the root and all publishable packages:

```bash
# Example: 67.0.0 → 68.0.0
# Update version in:
# - package.json (root)
# - packages/*/package.json (all publishable packages)
```

After merge, nightlies will automatically build with the new major version: `v68.0.0-nightly.develop.YYYYMMDD`

**Step 2: Build release with manual override**

After ≥7 days of nightly testing, trigger the release build with manual version override to prevent auto-bumping to 68.1.0:

```bash
gh workflow run buildReleaseFromPrerelease.yml \
  -f prereleaseTag="v68.0.0-nightly.develop.YYYYMMDD" \
  -f releaseVersion="68.0.0"
```

**Step 3: Test and publish**

Follow the standard [Publishing to Marketplace](#publishing-to-marketplace) flow:
- Download and test VSIX from GitHub pre-release
- Trigger `publishVSCode.yml` with version `68.0.0`
- Approve marketplace gates after testing

**Note:** Minor releases (68.0.0 → 68.1.0, 68.2.0, ...) use auto-calculate and don't require manual version updates.

## Downloading the .vsix from GitHub Action

### Options

- Download directly from the GitHub Action run. You will find artifacts that are associated with a run at the bottom of the summary screen
- Use the gh cli to download artifacts. `gh run download --dir /dir/where/you/want/the/vsix/files/ 3746978326`. The last arg is the GHA job id. This can be found in the UI or by executing `gh run list`.

**At this stage, it is possible to share the .vsix directly for manual
installation.**

To manually install vsix files you can use the `code` or `code-insiders` cli.

- `code-insiders --install-extension /path/to/the/vsix/iama.vsix`
- or install all downloaded vsix files `find ./vsix/download/path -type f -name "*.vsix" -exec code --install-extension {} \;`

## Generating SHA256

Due to [vscode-vsce#191](https://github.com/Microsoft/vscode-vsce/issues/191)
the .vsix are neither signed nor verified. To ensure that they have not been
tampered with, we generate a SHA256 of the contents and publish that to the
Salesforce developer site (see `vscode:sha256` script).

### Steps

1. `npm run vscode:sha256` will compute the SHA256 for the .vsix generated in
   the previous stage.
1. The SHA256 are appended to the top-level SHA256 file.
1. Finally the file is added to git so that it can be committed.

## Pushing .vsix to Visual Studio Marketplace

### Prerequisite

- You have a personal access token that for the salesforce publisher id that is
  exported as `VSCE_PERSONAL_ACCESS_TOKEN`. Go to [Publishing VS Code Extensions][publish_vscode_ext] for steps on getting your personal access token.
- Or, you have vsce installed and configured with the salesforce publisher id.
- Verify you have access to publish:

```
$ vsce login (publisher name)
```

### Steps

1. `npm run vscode:publish` takes the .vsix that you had _before_ and uploads
   it to the Visual Studio Code Marketplace.

It's **crucial** that you publish the .vsix that you had before so that the
SHA256 match. If you were to repackage, the SHA256 would be different.

## Merging Back From the Release Branch Into Develop and Main

### Prerequisite

- Artifacts have been published.

### Steps

See this
[guide](https://www.atlassian.com/git/tutorials/comparing-workflows#gitflow-workflow)
from Atlassian on the flow. These steps are manual because you might encounter merge conflicts.

1. `git checkout main`
1. `git pull` to get the latest changes (there shouldn't be any since you are
   the person releasing).
1. `git merge release/vxx.y.z`
1. `git push`
1. `git checkout develop`
1. `git pull` to get the latest changes.
1. `git merge release/vxx.y.z`
1. `git push`

## Manual Publish in Open VSX Registry

### Option 1: Using the Open VSX Website UI

1. Log in [Open VSX](https://open-vsx.org/) with the svc-idee-bot github account username and password.
2. In the Open VSX main page, find the settings by clicking the account avatar.
3. Go to the "Extensions" section under settings. Click the "publish extensions" button to drag and drop the vsix file to publish it.

### Option 2: Using the CLI Tool

1. Get the publish token from the LastPass shared folder.
2. Run `npx ovsx publish <vsix-file> -p <token>` locally to publish the vsix file on Open VSX.

# Tips

1. To make a previously unpublished extension publishable:
   1. Add extension to `extensionDependencies` list in `packages/salesforcedx-vscode/package.json`
   2. In extension's `package.json`, set `bugs` and `repository` URLs:
      - `bugs`: `https://github.com/forcedotcom/salesforcedx-vscode/issues`
      - `repository`: `https://github.com/forcedotcom/salesforcedx-vscode`
   3. Add required scripts — modern packages use wireit (see [Build](../docs/Build.md) and [vsce-direct-use](../docs/adr/0017-vsce-package-directly.md)); legacy need `vscode:prepublish`, `vscode:package:legacy`. All need `vscode:sha256`, `vscode:publish`.
   4. Ensure `package.json` has `engines.vscode`, `publisher`, `categories` — nightly builds auto-discover via [`scripts/list-vscode-extensions.js`](../scripts/list-vscode-extensions.js) (main bundle first, then alphabetical; no workflow updates needed).

[publish_vscode_ext]: https://code.visualstudio.com/docs/extensions/publish-extension
