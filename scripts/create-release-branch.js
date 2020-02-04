#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

if (!shell.which('lerna')) {
  console.log('lerna is not installed or could not be found');
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

  if (currentBranch !== 'develop') {
    console.log(
      `You must execute this script in the develop branch, you are currently running the script on branch ${currentBranch}`
    );
    process.exit(-1);
  }
}

const releaseBranchName = `release/v${nextVersion}`;

// git clean but keeping node_modules around
shell.exec('git clean -xfd -e node_modules');

// Create the new release branch and switch to it
shell.exec(`git checkout -b ${releaseBranchName}`);

// lerna version
// --skip-npm to increment the version number in all packages but not publish to npmjs
// This will make a commit in Git without generating a tag for the release
shell.exec(
  `lerna version --force-publish --allow-branch ${releaseBranchName} --no-git-tag-version --exact --repo-version ${nextVersion} --yes --skip-npm`
);
