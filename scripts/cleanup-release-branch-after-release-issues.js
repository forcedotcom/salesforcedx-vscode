#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

// Checks that you have specified the next version as an environment variable, and that it's properly formatted.
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
if (!nextVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)) {
  console.log(
    'You must set SALESFORCEDX_VSCODE_VERSION in the same format followed by the extension code e.g. 48.1.0'
  );
  process.exit(-1);
}

const releaseBranchName = `release/v${nextVersion}`;

// validate you are on the correct branch
const currentBranch = shell
  .exec('git rev-parse --abbrev-ref HEAD', {
    silent: true
  })
  .stdout.trim();

if (currentBranch !== releaseBranchName) {
  console.log(
    `You must execute this script in a release branch, you are currently running the script on branch ${currentBranch}`
  );
  process.exit(-1);
}

console.log('Reset release branch head back to what is on remote');
shell.exec(`git reset --hard origin/${releaseBranchName}`);

console.log('Remove all local untracked file changes in the project');
shell.exec(`git clean -xfd`);

const releaseTag = `v${nextVersion}`;
const isReleaseTagPresent = shell
  .exec(`git tag -l "${releaseTag}"`)
  .stdout.trim();
const isReleaseTagInRemote = shell
  .exec(`git ls-remote --tags origin ${releaseTag}`)
  .stdout.trim();

if (isReleaseTagPresent) {
  console.log(`Deleting tag ${releaseTag} in local`);
  shell.exec(`git tag --delete ${releaseTag}`);
} else {
  console.log(`No local git tag was found for ${releaseTag}`);
}

if (isReleaseTagInRemote) {
  console.log(`Deleting remote tag ${releaseTag}: ${isReleaseTagInRemote}`);
  shell.exec(`git push --delete origin ${releaseTag}`);
} else {
  console.log(`No remote git tag was found for ${releaseTag}`);
}
