# Introduction

This is a guide for publishing to the Visual Studio Code Marketplace. Most
contributors will not need to worry about publishing. However, it might be
worthwhile familiarizing yourself with the steps in case you need to share the
extensions through the .vsix files.

# Goal

The goal of publishing is to take the extensions under /packages, bundle them as
.vsix files, and push them to the [Visual Studio Code
Marketplace](https://marketplace.visualstudio.com/vscode).

For more information about publishing take a look at 

* [Publishing VS Code Extensions](https://code.visualstudio.com/docs/extensions/publish-extension)
* [Managing Extensions](https://code.visualstudio.com/docs/editor/extension-gallery)

# Steps

The scripts/publish.js contains the end-to-end flow. It is possible to run each step manually.

The files under scripts use [shelljs/shx](https://github.com/shelljs/shx) and
[shelljs/shelljs](https://github.com/shelljs/shelljs) to write scripts in a
portable manner across platforms.

## Packaging as .vsix

### Prerequisite

* Lerna is properly installed.

### Steps

1. `npm run bootstrap` to install all the dependencies and to symlink interdependent local modules.
1. `npm run compile` to compile all the TypeScript files.
1. `npm run test` to run all the tests.
1. `lerna publish ...` will increment the version in the individual package.json
   to prepare for publication. **This also commits the changes to git and adds a
   tag.**
1. `npm run vscode:package` packages _each_ extension as a .vsix.

**At this stage, it is possible to share the .vsix directly for manual installation.**

## Generating SHA256

Due to [vscode-vsce#191](https://github.com/Microsoft/vscode-vsce/issues/191)
the .vsix are neither signed nor verified. To ensure that they have not been
tampered with, we generate a SHA256 of the contents and publish that to
https://developer.salesforce.com/media/vscode/SHA256

### Prerequisite

* You have access to our S3 bucket at s3://dfc-data-production/media/vscode
* You have the [AWS CLI](https://aws.amazon.com/cli/) installed and configured
  via `aws configure` or have the `AWS_ACCESS_KEY_ID` and
  `AWS_SECRET_ACCESS_KEY` exported as environment variables.

### Steps

1. `npm run vscode:sha256` will compute the SHA256 for the .vsix generated in
   the previous stage.
1. The SHA256 are appended to the top-level SHA256 file.
1. This file is then copied over to our S3 bucket.
1. Finally the file is added to git so that it can be committed.

## Pushing .vsix to Visual Studio Marketplace

### Prerequisite

* You have a personal access token that for the salesforce publisher id that is
  exported as `VSCE_PERSONAL_ACCESS_TOKEN`. 
* Or, you have vsce installed and configured with the salesforce publisher id.

### Steps

1. `npm run vscode:publish` takes the .vsix that you had _before_ and uploads
   it to the Visual Studio Code Marketplace.

It's **crucial** that you publish the .vsix that you had before so that the
SHA256 match. If you were to repackage, the SHA256 would be different.

# Tips

1. After publishing, you will need to run `npm run bootstrap` again to continue
   development. This is because the `npm run vscode:package` step does a `npm
   prune --production`. This is required due to the way Lerna does symlinking.
   See [vscode-vsce#52](https://github.com/Microsoft/vscode-vsce/issues/52) for
   more information.