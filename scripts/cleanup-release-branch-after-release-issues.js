#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');
const REPO_ORIGIN = 'git@github.com:forcedotcom/salesforcedx-vscode.git';
const { checkBaseBranch, checkVSCodeVersion } = require('./validation-utils');
const logger = require('./logger-util');

// Checks that you have specified the next version as an environment variable, and that it's properly formatted.
checkVSCodeVersion();
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];

// Checks you are on the correct branch
const releaseBranchName = `release/v${nextVersion}`;
checkBaseBranch(releaseBranchName);
logger.header('\nReset release branch head back to what is on remote');
shell.exec(`git reset --hard origin/${releaseBranchName}`);

logger.header('\nRemove all local untracked file changes in the project');
shell.exec(`git clean -xfd`);

const releaseTag = `v${nextVersion}`;
const isReleaseTagPresent = shell.exec(`git tag -l "${releaseTag}"`).stdout.trim();
const isReleaseTagInRemote = shell.exec(`git ls-remote --tags ${REPO_ORIGIN} ${releaseTag}`).stdout.trim();

if (isReleaseTagPresent) {
  logger.header(`Deleting tag ${releaseTag} in local`);
  shell.exec(`git tag --delete ${releaseTag}`);
} else {
  logger.info(`No local git tag was found for ${releaseTag}`);
}

if (isReleaseTagInRemote) {
  logger.header(`Deleting remote tag ${releaseTag}: ${isReleaseTagInRemote}`);
  shell.exec(`git push --delete ${REPO_ORIGIN} ${releaseTag}`);
} else {
  logger.info(`No remote git tag was found for ${releaseTag}`);
}
