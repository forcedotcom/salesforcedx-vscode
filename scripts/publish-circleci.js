#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

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
 */

// Checks that you are running this with Node v12.4.0 and above
const [version, major, minor, patch] = process.version.match(
  /^v(\d+)\.?(\d+)\.?(\*|\d+)$/
);
if (parseInt(major) !== 12 || parseInt(minor) < 4) {
  console.log(
    'You do not have the right version of node. We require version 12.4.0.'
  );
  process.exit(-1);
}
// Check if you have installed all the required tooling
if (!shell.which('vsce')) {
  console.log('vsce is not installed or could not be found');
  process.exit(-1);
}

if (!shell.which('lerna')) {
  console.log('lerna is not installed or could not be found');
  process.exit(-1);
}

if (!shell.which('aws')) {
  console.log('aws cli is not installed or could not be found');
  process.exit(-1);
}

// Checks that you have access to our bucket on AWS
const awsExitCode = shell.exec(
  'aws s3 ls s3://dfc-data-production/media/vscode/SHA256.md',
  {
    silent: true
  }
).code;
if (awsExitCode !== 0) {
  console.log(
    'You do not have the s3 command line installed or you do not have access to the aws s3 bucket.'
  );
  process.exit(-1);
}

// Checks that you have access to the salesforce publisher
const publishers = shell
  .exec('vsce ls-publishers', { silent: true })
  .stdout.trim();
if (!publishers.includes('salesforce')) {
  console.log(
    'You do not have the vsce command line installed or you do not have access to the salesforce publisher id as part of vsce.'
  );
  process.exit(-1);
}

// Checks that you have specified the next version as an environment variable, and that it's properly formatted.
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
const releaseBranchName = `release/v${nextVersion}`;

// Check release version environment variable
if (!nextVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)) {
  console.log(
    'You must set SALESFORCEDX_VSCODE_VERSION in the same format followed by the extension code e.g. 48.1.0'
  );
  process.exit(-1);
}

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
