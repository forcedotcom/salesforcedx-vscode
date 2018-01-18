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
 * Run this script with SALESFORCEDX_VSCODE_VERSION as an environment variable
 * i.e. SALESFORCEDX_VSCODE_VERSION=x.y.z ./scripts/publish.js
 * 
 */

// Checks that you are running this with Node v8.9.0 and above
const [version, major, minor, patch] = process.version.match(
  /^v(\d+)\.?(\d+)\.?(\*|\d+)$/
);
if (parseInt(major) !== 8 || parseInt(minor) < 9) {
  console.log(
    'You do not have the right version of node. We require version 8.9.0.'
  );
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
const publishers = shell.exec('vsce ls-publishers', { silent: true }).stdout;
if (!publishers.includes('salesforce')) {
  console.log(
    'You do not have the vsce command line installed or you do not have access to the salesforce publisher id as part of vsce.'
  );
  process.exit(-1);
}

// Checks that you have specified the next version as an environment variable, and that it's properly formatted.
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
if (!nextVersion) {
  console.log(
    'You must specify the next version of the extension by setting SALESFORCEDX_VSCODE_VERSION as an environment variable.'
  );
  process.exit(-1);
} else {
  const [version, major, minor, patch] = nextVersion.match(
    /^(\d+)\.(\d+)\.(\d+)$/
  );
  const currentBranch = shell.exec('git rev-parse --abbrev-ref HEAD', {
    silent: true
  }).stdout;

  if (!currentBranch.includes('/v' + nextVersion)) {
    console.log(
      `You must execute this script in a release branch including SALESFORCEDX_VSCODE_VERSION (e.g, release/v${nextVersion} or hotfix/v${nextVersion})`
    );
    process.exit(-1);
  }
}

// Checks that a tag of the next version doesn't already exist
const checkTags = shell.exec('git tag', { silent: true }).stdout;
if (checkTags.includes(nextVersion)) {
  console.log(
    'There is a conflicting git tag. Reclone the repository and start fresh to avoid versioning problems.'
  );
  process.exit(-1);
}

// Real-clean
shell.exec('git clean -xfd -e node_modules');

// Install and bootstrap
shell.exec('npm install');

// Compile
shell.exec('npm run compile');

// lerna publish
// --skip-npm to increment the version number in all packages but not publish to npmjs
// This will still make a commit in Git with the tag of the version used
shell.exec(
  `lerna publish --force-publish --exact --repo-version ${nextVersion} --yes --skip-npm`
);

// Generate the .vsix files
shell.exec(`npm run vscode:package`);

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

// Add formatting changes
shell.exec(`git add .`);

// Commit back changes after reformatting
shell.exec(`git commit -m "Reformat for lerna"`);

// Publish to VS Code Marketplace
shell.exec(`npm run vscode:publish`);
