#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const {
  checkEnvironmentVariables,
  checkNodeVerion,
  checkLernaInstall,
  checkVSCEInstall,
  checkAWSCliInstall,
  checkAWSAccess,
  checkSalesforcePublisherAccess,
  checkBaseBranch
} = require('./validation-utils');

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

if (process.argv.indexOf('-v') > -1) {
  console.log('Running prevalidation of environment variables.');
  console.log(`SALESFORCEDX_VSCODE_VERSION: ${process.env['SALESFORCEDX_VSCODE_VERSION']}`);
  console.log(`CIRCLECI_TOKEN: ${process.env['CIRCLECI_TOKEN']}`);
  console.log(`CIRCLECI_BUILD: ${process.env['CIRCLECI_BUILD']}`);
  process.exit(-1);
}

checkEnvironmentVariables();
checkBaseBranch(`release/v${process.env['SALESFORCEDX_VSCODE_VERSION']}`);
checkNodeVerion();
checkLernaInstall();
checkVSCEInstall();
checkAWSCliInstall();
checkAWSAccess();
checkSalesforcePublisherAccess();

// Download vsix files from CircleCI
shell.exec('./scripts/download-vsix-from-circleci.js');

// Generate the SHA256 and append to the file
shell.exec(`npm run vscode:sha256`);

// Concatenate the contents to the proper SHA256.md
shell.exec('./scripts/concatenate-sha256.js');

// Remove the temp SHA256 file
shell.rm('./SHA256');

// Push the SHA256 to AWS
shell.exec(
  'aws s3 cp ./SHA256.md s3://dfc-data-production/media/vscode/SHA256.md'
);

// Add SHA256 to git
shell.exec(`git add SHA256.md`);

// Git commit
shell.exec(`git commit -m "Updated SHA256"`);

// Create a git tag e.g. v48.1.0
const gitTagName = `v${nextVersion}`;
shell.exec(`git tag ${gitTagName}`);

// Push git tag to remote
shell.exec(`git push origin ${gitTagName}`);

// Publish to VS Code Marketplace
shell.exec(`npm run vscode:publish`);
