# Publishing

This is a guide for publishing to the Visual Studio Code Marketplace and the Open VSX Registry. Most contributors will not need to worry about publishing. However, it might be worthwhile familiarizing yourself with the steps in case you need to share the extensions through the .vsix files.

# Goal

The goal of publishing is to take the extensions under `/packages`, bundle them as
.vsix files, and push them to the [Visual Studio Code
Marketplace](https://marketplace.visualstudio.com/vscode) and the [Open VSX Registry](https://open-vsx.org/).

For more information about publishing take a look at:

- [Publishing VS Code Extensions][publish_vscode_ext]
- [Managing Extensions](https://code.visualstudio.com/docs/editor/extension-gallery)
- [Publishing Extensions on Open VSX Registry](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)

# Prerequisites

1. Publisher is a part of the GitHub team 'IDE Experience'.

# Steps

## Create a Release Branch

A scheduled [Github Action](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/createReleaseBranch.yml) creates the release branch off of the `develop` branch on Mondays at 1PM GMT (i.e. 5AM or 6AM Pacific time depending on daylight savings). Release branches are in the format of `release/vXX.YY.ZZ`.

If any code changes are made between the time the release branch is automatically created and the actual release time, the engineer should run the `Create Release Branch` workflow with `patch` selected from the dropdown to create a new branch that contains those code changes.

## Compare Changes in the Release

When verifying the release, verify that it contains changes. One can see the changes in GitHub using an URL to diff the changes between releases, with an URl in the format of https://github.com/forcedotcom/salesforcedx-vscode/compare/release/v57.7.0...release/v57.8.0.

If no changes were made the previous week, then the release can be skipped (no actions beyond this point)

## Updating the Changelog

The changelog will be automatically generated as part of the Create Release Branch workflow. This task will gather commits that should be published (like `feat` or `fix`) and write the update to `CHANGELOG.md`. If there are no commits worth publishing (for instance, if everything was a `chore` or a `ci` commit), then the changelog entry for the upcoming release can be skipped. The workflow will then push the changelog to the release branch with the commit name of `chore: generated CHANGELOG for vXX.YY.ZZ`, where XX.YY.ZZ are the numbers of the current release.

The engineer should edit the contents of the changelog, and have the team and doc writer review. During the update process, if the writer wants to make further changes to changelog through the browser, they can do that by switching the branch from develop to release/vXX.YY.ZZ and go to `CHANGELOG.md` and clicking on the pencil icon to edit the file.

## Merging the Release Branch into Main

After everyone is satisfied with the changelog updates, a Github Action instead of just merging because we want all the commits from our release branch to be applied on top of the commits in the `main` branch.

1. From the GitHub repository navigate to the Actions tab, and select the [PreRelease](https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/prerelease.yml) workflow on the left
1. Click the 'Run Workflow' dropdown button on the right
1. In the form that appears, set the branch to `develop`, and set the 'branch to be released' input box to the name of the release (eg `release/v58.0.0`)
1. Click the 'Run Workflow' button.

The PreRelease job will verify if the version of the branch to be merged is newer than what is currently in the `main` branch and update `main` with the release branch.

## Publishing Main

The merge into `main` will trigger a run of the 'Test, Build, and Release' GHA workflow (https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/testBuildAndRelease.yml) that will:

- run the tests
- build vsix files
- send a slack notification that a release workflow has been initiated
- create a tag and release in GitHub

After the release has been created, it will trigger two publish actions for publishing in the MS Marketplace and the Open VSX. Each action will send a notification to slack to request approval to publish the vsix files.

Before approving the release to the marketplace, download the vsix files from the release you just created, install them locally and verify they are working as expected.

Alternatively, you can download the files using the [gh cli](https://cli.github.com/) and then upload them all at once. Replace `v57.3.0` with the tag name for the release that you are testing, and to whatever download directory you would like. Additionally, `code` can be replaced by `code-insiders`.

`> gh release download v57.3.0 --dir ~/Downloads/v57.3.0 --pattern '*.vsix'`
`> find ~/Downloads/v53.3.0 -type f -name "*.vsix" -exec code --install-extension {} \;`

After completing your release testing following our internal template, approve the publish job "Publish in Microsoft Marketplace" and "Publish in Open VSX Registry" to allow the extensions to be uploaded and complete the release process.

## Post-Publishing the .vsix

1. Update the Salesforce Extension Pack to the version you just published. Either go to the Extensions tab, select Salesforce Extension pack, and update... or go to https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode, download the version you published, and install. The publish may take a few minutes to register in the marketplace.
2. Restart Visual Studio Code
3. Test & validate the application - verify all the extensions are running, and run a command or two.
4. Once validated, post an announcement in #platform-dev-tools

---

# Publishing a Beta Pre-Release

If there is a release with high-risk or large-scale changes, we can publish a pre-release to allow advanced users to test early. VSIX artifacts are uploaded to a GitHub release as with our usual release but there is no publish to NPM or the VS Code Marketplace (yet).

## Steps

1. Create a release branch, and increment the version using Lerna, as shown in the `create-release-branch.js` file, starting at the creation of the release branch.
2. For the version number, keep the minor version the same and set the patch to use the following format: year month day hour minute. For example, v55.11.202208260522.
3. Push the branch to remote.
4. From the Actions tab in GitHub select the workflow 'Publish Beta Release to GitHub Only'.
5. Select 'Run Workflow', and run the workflow from the beta branch. The workflow can only be run someone with write privileges of this repo.
6. The workflow will create the git tag, the release, and attach the individual VSIX files to the release where they can be downloaded and tested.

Note that the beta branch, because of the unique versioning, should not be merged back to develop. When the code is ready for a standard release, the regular release branching process should be followed.

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
tampered with, we generate a SHA256 of the contents and publish that to
https://developer.salesforce.com/media/vscode/SHA256

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

1. In order to make a previously unpublished extension publishable there are a
   few things that need to get updated:
   1. In packages/salesforcedx-vscode/package.json the extension needs to get added
      to the list of `extensionDependencies`
   2. In the extension's package.json ensure that `bugs` and `repository` both have
      their `url` attributes set.
      For `bugs` the url is `https://github.com/forcedotcom/salesforcedx-vscode/issues`
      For `repository` the url is `https://github.com/forcedotcom/salesforcedx-vscode`
   3. In the extension's package.json, under `scripts` the following attributes need
      to be defined:
      `"vscode:prepublish": "npm prune --production"`
      `"vscode:package": "vsce package"`
      `"vscode:sha256": "node ../../scripts/generate-sha256.js >> ../../SHA256"`
      `"vscode:publish": "node ../../scripts/publish-vsix.js"`

[publish_vscode_ext]: https://code.visualstudio.com/docs/extensions/publish-extension
