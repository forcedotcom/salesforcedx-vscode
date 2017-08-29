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
 */

// Checks that you are running this with Node v7.9.0 and above
const [version, major, minor, patch] = process.version.match(
  /^v(\d+)\.?(\d+)\.?(\*|\d+)$/
);
if (major !== 7 || minor < 9) {
  console.log(
    'You do not have the right version of node. We require version 7.9.0 and above (but not Node 8, yet).'
  );
  exit(-1);
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
  exit(-1);
}

// Checks that you have access to the salesforce publisher
const publishers = shell.exec('vsce ls-publishers', { silent: true }).stdout;
if (!publishers.includes('salesforce')) {
  console.log(
    'You do not have the vsce command line installed or you do not have access to the salesforce publisher id as part of vsce.'
  );
  exit(-1);
}

// Real-clean
shell.exec('git clean -xfd');

// Install and bootstrap
shell.exec('npm install');

// Compile
shell.exec('npm run compile');

// lerna publish
// --skip-npm to increment the version number in all packages but not publish to npmjs
// This will still make a commit in Git with the tag of the version used
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];
if (nextVersion) {
  shell.exec(
    `lerna publish --force-publish --exact --repo-version ${nextVersion} --yes --skip-npm`
  );
} else {
  shell.exec(
    'lerna publish --force-publish --exact --cd-version minor --yes --skip-npm'
  );
}

// Reformat with prettier since lerna changes the formatting in package.json
shell.exec('./scripts/reformat-with-prettier.js');

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

// Publish to VS Code Marketplace
shell.exec(`npm run vscode:publish`);

// Push back to GitHub
// shell.exec(`git push`);
