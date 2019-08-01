const process = require('process');
const path = require('path');
const shell = require('shelljs');
const readlineS = require('readline-sync');

/*
 * Assumptions:
 * 1. You have shelljs installed globally using `npm install -g shelljs`.
 * 2. The release branch in question has already been cut.
 * 3. readline-sync is installed using 'npm install readline-sync'
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
    printError("Invalid release '" + input + "'. Expected format [xx.y.z].");
  }
}

/**
 * Prints the message to the error stream and exits the script.
 */
function printError(errorMessage) {
  process.stderr.write(errorMessage + '\n');
  process.exit(-1);
}

var latestReleaseBranch = getLatestReleaseBranch();
var input = readlineS.question('Is this the correct release Branch? (Y/n): ');

if (!isUserInputYorN(input)) {
  printError('Expected Input: Y/n. Unknown user input: ' + input);
} else if (input.toUpperCase() == 'N') {
  input = readlineS.question('Enter release branch in format xx.y.z: ');
  latestReleaseBranch = verifyUserReleaseBranch(input);
}

// TODO - verify branch doesn't already exist.
var changeLogBranch = 'changeLogGenerated-v' + latestReleaseBranch;
process.stdout.write('Release branch result: ' + latestReleaseBranch);
shell.exec('git checkout ' + path.join('release', 'v' + latestReleaseBranch));
shell.exec('git branch ' + changeLogBranch);
shell.exec('git checkout ' + changeLogBranch);

// At this point, our new branch for the change log should mirror the release branch.
// Now we need to check the log for all of the commits that were added for this new release.
var result = shell.exec('git log --oneline'); //.stdout.split('Updated SHA256', 1);
console.log('Results from log: ' + result);

// TODO - get all files for each of the commits.
//shell.exec('git show --pretty="" --name-only <commit>');
