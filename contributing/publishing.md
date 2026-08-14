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

## Create a Release Branch

Scheduled [Github Action](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/createReleaseBranch.yml) creates release branch from `develop` Mondays 1PM GMT. Format: `release/vXX.YY.ZZ`.

For code changes post-creation, run `Create Release Branch` workflow with `patch` to create new branch.

## Compare Changes in the Release

Verify release contains changes via diff URL: `https://github.com/forcedotcom/salesforcedx-vscode/compare/release/vX.Y.Z...release/vX.Y.(Z+1)`

No changes? Skip release.

## Updating the Changelog

Create Release Branch workflow auto-generates changelog: gathers `feat`/`fix` commits, writes to `CHANGELOG.md`. If only `chore`/`ci` commits, skip changelog. Pushed as `chore: generated CHANGELOG for vXX.YY.ZZ`.

Edit changelog; team/doc writer reviews. Browser edits: switch to `release/vXX.YY.ZZ`, click pencil on `CHANGELOG.md`.

See [.claude/skills/changelog/SKILL.md](../.claude/skills/changelog/SKILL.md) for format/rules.

## Merging the Release Branch into Main

Use [PreRelease](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/prerelease.yml) workflow (not manual merge) to apply release commits on top of `main`.

1. GitHub Actions tab → [PreRelease](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/prerelease.yml) workflow
2. 'Run Workflow' dropdown
3. Set branch to `develop`, 'branch to be released' to release name (e.g., `release/v58.0.0`)
4. 'Run Workflow'

Verifies release version is newer than `main`, updates `main` with release commits.

### Potential Errors

If you get `error: failed to push some refs to 'https://github.com/forcedotcom/salesforcedx-vscode'` on the merge step

1. check out the merge branch locally
2. `git merge` main into it
3. push
4. run `PreRelease` workflow again

## Nightly Builds & Pre-release Promotion

**Nightly builds:** `nightly.yml` publishes all extensions to pre-release channels daily (4 AM UTC) + on-demand. Auto-discovers extensions via [`scripts/list-vscode-extensions.js`](../scripts/list-vscode-extensions.js).

**Pre-release promotion:** `promote-prerelease.yml` (Wednesdays 7 AM UTC) promotes nightly builds to pre-release channels when stability criteria met: nightly tag ≥7 days old + all CI checks passed on tag's commit. Allows safe rollback window before general release.

**Build from promoted prerelease:** `buildReleaseFromPrerelease.yml` (manual workflow_dispatch) builds release VSIXs from promoted prerelease tags for internal testing before marketplace publish. Accepts optional `prereleaseTag` (auto-detects latest if omitted) and `releaseVersion` (auto-bumps minor if omitted). Creates GitHub pre-release with testing checklist and VSIX artifacts. Use before triggering `publishVSCode.yml` for final marketplace publish.

**Artifact retention:** Nightly builds retain artifacts 30 days (vs. 5 days for PR builds) to support promotion workflows accessing build artifacts for stability verification.

## Publishing Main

Merge to `main` triggers [testBuildAndRelease](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/testBuildAndRelease.yml):
- Run tests
- Build VSIX files
- Send Slack notification
- Create git tag + GitHub release

Then triggers `publishVSCode.yml`:
- Verify release exists (required for manual workflow_dispatch triggers)
- Download VSIX files; validate ≥1 present, exit if missing
- Upload as artifact for validation
- Validate VSIX OPC Part URIs (via artifact)
- Call shared workflow [`vscode-publish-extensions`](https://github.com/salesforcecli/github-workflows/blob/main/.github/workflows/vscode-publish-extensions.yml) with `nightly: false` (boolean) to publish to VS Code Marketplace, Open VSX, and other configured registries
- Send approval notification

**Note:** Shared workflow defaults `nightly: true` (skips marketplace publishing). Pass `nightly: false` as boolean (not string) for proper YAML type handling.

**Manual workflow_dispatch triggers:** If manually triggering `publishVSCode.yml`, ensure `testBuildAndRelease.yml` has already created the GitHub release with VSIX artifacts. The workflow validates the release exists before attempting downloads and will fail early with a clear error if the release is missing.

Before approving marketplace publish, download VSIX files, install locally, verify functionality.

Use [gh cli](https://cli.github.com/) (replace `v64.8.0` with your tag; `code` → `code-insiders` as needed):

```sh
gh release download v64.8.0 --dir ~/Downloads/v64.8.0 --pattern '*.vsix' --repo forcedotcom/salesforcedx-vscode
find ~/Downloads/v64.8.0 -type f -name "*.vsix" -exec code --install-extension {} \;
```

After testing (per internal template), approve "Publish in Microsoft Marketplace" and "Publish in Open VSX Registry" jobs.

### Web Console Release

After extensions are published to the MS Marketplace, Web Console needs a new release so customers get the updated extensions. There are two paths:

**Automatic (default):** The `publishVSCode.yml` workflow dispatches to `code-builder-web/release-on-extension-publish.yml` via `workflow_call`. That workflow polls the marketplace until the published extensions are available at the new version, then triggers a Web Console release with auto-promote to production. No manual steps needed.

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

The versioning we follow is intentionally mapped with Salesforce Core. When a major version bump occurs, such as 53.0 -> 54.0, we release a major version update as well.

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
