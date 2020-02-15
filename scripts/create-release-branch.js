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
  const currentBranch = shell
    .exec('git rev-parse --abbrev-ref HEAD', {
      silent: true
    })
    .stdout.trim();

  if (currentBranch !== 'develop') {
    console.log(
      `You must execute this script in the develop branch, you are currently running the script on branch ${currentBranch}`
    );
    process.exit(-1);
  }
}

const releaseBranchName = `release/v${nextVersion}`;

// Check if release branch has already been created
const isRemoteReleaseBranchExist = shell
  .exec(
    `git ls-remote --heads git@github.com:forcedotcom/salesforcedx-vscode.git ${releaseBranchName}`,
    {
      silent: true
    }
  )
  .stdout.trim();

if (isRemoteReleaseBranchExist) {
  console.log(
    `${releaseBranchName} already exists in remote. You might want to verify the value assigned to SALESFORCEDX_VSCODE_VERSION`
  );
  process.exit(-1);
}

// git clean but keeping node_modules around
shell.exec('git clean -xfd -e node_modules');

// Create the new release branch and switch to it
shell.exec(`git checkout -b ${releaseBranchName}`);

// lerna version
// increment the version number in all packages without publishing to npmjs
// only run on branch named release/vxx.xx.xx and do not create git tags
shell.exec(
  `lerna version ${nextVersion} --force-publish --allow-branch ${releaseBranchName} --no-git-tag-version --exact --yes`
);

// Using --no-git-tag-version prevents creating git tags but also prevents commiting
// all the version bump changes so we'll now need to commit those using git add & commit.
// Add all package.json version update changes
shell.exec(`git add "**/package.json"`);

// Add change to lerna.json
shell.exec('git add lerna.json');

// Git commit
shell.exec(`git commit -m "Update to version ${nextVersion}"`);

// Push new release branch to remote
shell.exec(`git push -u origin ${releaseBranchName}`);
