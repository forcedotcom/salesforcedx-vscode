const process = require('process');
const path = require('path');
const shell = require('shelljs');
const readline = require('readline');

/*
 * Assumptions:
 * 1. You have shelljs installed globally using `npm install -g shelljs`.
 * 2. The release branch in question has already been cut.
 */

// Commands
const BRANCH_SEARCH_COMMAND =
  "git branch --remotes --list --sort='-creatordate' 'origin/release/v*'";
const diffCommand = 'git log --oneline';

// Constants
const changeLogPath = path.join(
  process.cwd(),
  'packages',
  'salesforce-vscode',
  'CHANGELOG.md'
);

/**
 * Gets the latest release branch. Assumes that the branch has already been cut.
 */
function getLatestReleaseBranch() {
  var latestReleaseBranch = shell
    .exec(BRANCH_SEARCH_COMMAND, { silent: true })
    .stdout.trim()
    .replace('origin/release/v', '')
    .split(' ', 1);
  process.stdout.write('Latest Release Branch: ' + latestReleaseBranch);
  return latestReleaseBranch;
}

/**
 * Determines if the user's input is 'y' or 'n'.
 */
function isUserInputYorN(input) {
  return input && (input.toUpperCase() == 'Y' || input.toUpperCase() == 'N');
}

/**
 * Verifies the release input from the user. If the release appears to be valid,
 * return it. Otherwise error with the expected format.
 */
function verifyUserReleaseBranch(input) {
  if (input && input.match(/^\d{2}\.\d\.\d/)) {
    return input;
  } else {
    printError('Invalid release ' + input + '. Expected [xx.y.z].');
  }
}

/**
 * Prints the message to the error stream and exits the script.
 */
function printError(errorMessage) {
  process.stderr.write(errorMessage);
  process.exit(-1);
}

var latestReleaseBranch = getLatestReleaseBranch();
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.question('Is this the correct release branch? Y/n: ', input => {
  if (!isUserInputYorN(input)) {
    printError('Expected Input: Y/n. Unknown user input: ' + input);
  } else if (input.toUpperCase() == 'N') {
    rl.question('Enter release branch in format xx.y.z: ', input => {
      latestReleaseBranch = verifyUserReleaseBranch(input);
    });
  }
  process.stdout.write('Release branch result: ' + latestReleaseBranch);
  //shell.exec('git checkout ' + path.join('release', 'v' + latestReleaseBranch));
  rl.close();
}).on('error', function(e) {
  console.log('Reached unexpected error.', e);
});
