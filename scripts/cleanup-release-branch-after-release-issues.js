#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');
const REPO_ORIGIN = 'git@github.com:forcedotcom/salesforcedx-vscode.git';
const { checkBaseBranch, checkVSCodeVersion } = require('./validation-utils');

// Checks that you have specified the next version as an environment variable, and that it's properly formatted.
checkVSCodeVersion();
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];

// Checks you are on the correct branch
const releaseBranchName = `release/v${nextVersion}`;
checkBaseBranch(releaseBranchName);

console.log('Reset release branch head back to what is on remote');
shell.exec(`git reset --hard origin/${releaseBranchName}`);

console.log('Remove all local untracked file changes in the project');
shell.exec(`git clean -xfd`);

const releaseTag = `v${nextVersion}`;
const isReleaseTagPresent = shell
  .exec(`git tag -l "${releaseTag}"`)
  .stdout.trim();
const isReleaseTagInRemote = shell
  .exec(`git ls-remote --tags ${REPO_ORIGIN} ${releaseTag}`)
  .stdout.trim();

if (isReleaseTagPresent) {
  console.log(`Deleting tag ${releaseTag} in local`);
  shell.exec(`git tag --delete ${releaseTag}`);
} else {
  console.log(`No local git tag was found for ${releaseTag}`);
}

if (isReleaseTagInRemote) {
  console.log(`Deleting remote tag ${releaseTag}: ${isReleaseTagInRemote}`);
  shell.exec(`git push --delete ${REPO_ORIGIN} ${releaseTag}`);
} else {
  console.log(`No remote git tag was found for ${releaseTag}`);
}
