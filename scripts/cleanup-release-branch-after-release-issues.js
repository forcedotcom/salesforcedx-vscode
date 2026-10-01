#!/usr/bin/env node

const { execSync } = require('child_process');
const REPO_ORIGIN = 'git@github.com:forcedotcom/salesforcedx-vscode.git';
const { checkBaseBranch, checkVSCodeVersion } = require('./validation-utils');
const logger = require('./logger-util');

// Exit on error
process.on('uncaughtException', err => {
  console.error(err);
  process.exit(1);
});

// Verbose output
process.env.DEBUG = '*';

// Checks that you have specified the next version as an environment variable, and that it's properly formatted.
checkVSCodeVersion();
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];

// Checks you are on the correct branch
const releaseBranchName = `release/v${nextVersion}`;
checkBaseBranch(releaseBranchName);
logger.header('\nReset release branch head back to what is on remote');
execSync(`git reset --hard origin/${releaseBranchName}`, { stdio: 'inherit' });

logger.header('\nRemove all local untracked file changes in the project');
execSync(`git clean -xfd`, { stdio: 'inherit' });

const releaseTag = `v${nextVersion}`;
const isReleaseTagPresent = execSync(`git tag -l "${releaseTag}"`, { encoding: 'utf8' }).trim();
const isReleaseTagInRemote = execSync(`git ls-remote --tags ${REPO_ORIGIN} ${releaseTag}`, { encoding: 'utf8' }).trim();

if (isReleaseTagPresent) {
  logger.header(`Deleting tag ${releaseTag} in local`);
  execSync(`git tag --delete ${releaseTag}`, { stdio: 'inherit' });
} else {
  logger.info(`No local git tag was found for ${releaseTag}`);
}

if (isReleaseTagInRemote) {
  logger.header(`Deleting remote tag ${releaseTag}: ${isReleaseTagInRemote}`);
  execSync(`git push --delete ${REPO_ORIGIN} ${releaseTag}`, { stdio: 'inherit' });
} else {
  logger.info(`No remote git tag was found for ${releaseTag}`);
}
