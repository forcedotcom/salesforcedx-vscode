#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const {
  checkEnvironmentVariables,
  checkNodeVersion,
  checkLernaInstall,
  checkVSCEInstall,
  checkSalesforcePublisherAccess,
  checkBaseBranch
} = require('./validation-utils');

const logger = require('./logger-util');

/*
 * Assumptions:
 * 0. You have shelljs installed globally using `npm install -g shelljs`.
 * 1. The script is running locally - it's not optimized for Travis workflow
 *    yet.
 * 2. The script is running in the right branch (e.g., release/vxx.y.z)
 *
 * Instructions:
 * Run this script with SALESFORCEDX_VSCODE_VERSION, CIRCLECI_TOKEN & CIRCLECI_BUILD as environment variables
 * i.e. SALESFORCEDX_VSCODE_VERSION=x.y.z ./scripts/publish-circleci.js
 *
 * To run a prevalidation for the environment variables run `node scripts/publish-circleci.js -- -v`.
 */
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];

if (process.argv.indexOf('-v') > -1) {
  logger.header('\nRunning pre-validation of environment variables.');
  logger.debug(`SALESFORCEDX_VSCODE_VERSION: ${nextVersion}`);
  logger.debug(`CIRCLECI_TOKEN: ${process.env['CIRCLECI_TOKEN']}`);
  logger.debug(`CIRCLECI_BUILD: ${process.env['CIRCLECI_BUILD']}`);
  process.exit();
}

checkEnvironmentVariables();
checkBaseBranch(`release/v${nextVersion}`);
checkNodeVersion();
checkLernaInstall();
checkVSCEInstall();
checkSalesforcePublisherAccess();

logger.header('\nDownload vsix files from CircleCI');
shell.exec('./scripts/download-vsix-from-circleci.js');

logger.header('\nGenerating the SHA256 and appending to the file.');
shell.exec(`npm run vscode:sha256`);

logger.header('\nConcatenating the contents to the proper SHA256.md');
shell.exec('./scripts/concatenate-sha256.js');

logger.header('\nRemoving the temp SHA256 file.');
shell.rm('./SHA256');

logger.header('\nAdding the SHA256 to git.');
shell.exec(`git add SHA256.md`);

logger.header('\nRunning commit.');
shell.exec(`git commit -m "chore: updated SHA256 v${nextVersion}"`);

const gitTagName = `v${nextVersion}`;
logger.header(`\nCreating the git tag (e.g. v48.1.0): ${gitTagName}`);
shell.exec(`git tag ${gitTagName}`);

logger.header('\nPushing git tag to remote.');
shell.exec(`git push origin ${gitTagName}`);

logger.header('\nPublishing to the VS Code Marketplace.');
shell.exec(`npm run vscode:publish`);
