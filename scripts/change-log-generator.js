/*
 * Automates the process of building the change log for releases.
 *
 * Assumptions:
 * 1. You have shelljs installed globally using `npm install -g shelljs`.
 * 2. The release branch in question has already been cut.
 * 3. readline-sync is installed using 'npm install readline-sync'
 */

// Imports
const process = require('process');
const path = require('path');
const shell = require('shelljs');
const readline = require('readline-sync');
const fs = require('fs');

// Constants
const CHANGE_LOG_PATH = path.join(
  process.cwd(),
  'packages',
  'salesforce-vscode',
  'CHANGELOG.md'
);
const CHANGE_LOG_BRANCH = 'changeLog-v';
const RELEASE_REGEX = new RegExp(/^\d{2}\.\d{1,2}\.\d/);

// Map Keys
const PR_NUM = 'PR NUM';
const COMMIT = 'COMMIT';
const MESSAGE = 'MESSAGE';
const FILES = 'FILES';
const PACKAGES = 'PACKAGES';

/**
 * Gets the latest release branch from git. Retrieves all remote branches
 * with the name 'origin/release/v*', sorts them in reverse order based on
 * creation date, and truncates this result so that only the latest branch
 * is returned.
 */
function getLatestReleaseBranch() {
  var latestReleaseBranch = shell
    .exec(
      "git branch --remotes --list --sort='-creatordate' 'origin/release/v*'",
      { silent: true }
    )
    .stdout.trim()
    .replace('origin/release/v', '')
    .split(' ', 1);
  process.stdout.write('Latest Release Branch: ' + latestReleaseBranch);
  return latestReleaseBranch;
}

/**
 * Gets the release branch. Allows user to override the default value.
 */
function getReleaseBranch() {
  var releaseBranch = getLatestReleaseBranch();
  var input = readline.question('Is this branch correct? (Y/n): ');
  if (!input) {
    exitWithError('Invalid input. Expected Input: Y/n.');
  } else if (input.toUpperCase() != 'Y' && input.toUpperCase() != 'N') {
    exitWithError('Expected Input: Y/n. Unknown user input: ' + input);
  } else if (input.toUpperCase() == 'N') {
    releaseBranch = readline.question('Enter release branch (xx.yy.z): ');
  }
  return releaseBranch;
}

/**
 * Verifies the release branch is in the correct format.
 */
function validateReleaseBranch(releaseBranch) {
  if (!(releaseBranch && RELEASE_REGEX.exec(releaseBranch))) {
    printError(
      "Invalid release '" + releaseBranch + "'. Expected format [xx.yy.z]."
    );
  }
  process.stdout.write('Using release branch: ' + releaseBranch);
}

/**
 * Checks out the release branch specified. Builds a new change log
 * branch using the release branch as its base.
 */
function getNewChangeLogBranch(releaseBranch) {
  var changeLogBranch = CHANGE_LOG_BRANCH + releaseBranch;
  shell.exec('git checkout ' + path.join('release', 'v' + releaseBranch));
  shell.exec('git branch ' + changeLogBranch);
  shell.exec('git checkout ' + changeLogBranch);
}

/**
 * At this point our new branch should mirror the release branch. Now when
 * we review the log we can retrieve all of the commits specific to this
 * release. Parse this info and return it as a list of hashmaps.
 */
function getCommitsAsListOfMaps() {
  var commits = shell
    .exec('git log --oneline', { silent: true })
    .stdout.trim()
    .split(new RegExp(/\n\d+ Updated SHA256/), 1)
    .toString()
    .split('\n');
  var result = [];
  for (var i = 0; i < commits.length; i++) {
    var commitMap = buildMapFromCommit(commits[i]);
    if (commitMap && Object.keys(commitMap).length > 0) {
      result.push(buildMapFromCommit(commits[i]));
    }
  }
  return result;
}

function buildMapFromCommit(commit) {
  var map = {};
  if (commit && !commit.includes('Merge branch')) {
    var pr = new RegExp(/(\(#\d+\))/).exec(commit);
    var commitNum = new RegExp(/^([\da-zA-Z]+)/).exec(commit);
    if (pr && commitNum) {
      var message = commit.replace(commitNum[0], '').replace(pr[0], '');
      map[PR_NUM] = pr[0];
      map[COMMIT] = commitNum[0];
      map[MESSAGE] = message.trim();
      map[FILES] = getFilesChangedForCommit(map[COMMIT]);
      map[PACKAGES] = getPackageHeader(map[FILES]);
    }
  }
  return map;
}

function getFilesChangedForCommit(commitNumber) {
  var packageHeader = '';
  var filesChanged = shell
    .exec('git show --pretty="" --name-only ' + commitNumber, { silent: true })
    .stdout.trim()
    .toString()
    .replace(/\n/g, ',');
  packageHeader = filesChanged;
  return packageHeader;
}

function getPackageHeader(filesChanged) {
  var packageHeaders = new Set();
  filesChanged.split(',').forEach(function(filePath) {
    if (
      filePath &&
      !filePath.includes('/images/') &&
      !filePath.includes('/test/')
    ) {
      if (filePath.includes('docs/')) {
        packageHeaders.add('docs');
      } else {
        packageHeaders.add(filePath.replace('packages/', '').split('/')[0]);
      }
    }
  });
  return packageHeaders;
}

function getChangeLog(releaseBranch, commitsAsArrayOfMaps) {
  var text =
    releaseBranch.toString().replace('\n', '') +
    ' - (INSERT RELEASE DATE [Month Day, Year])\n';
  text += '\n## Fixed\nINSERT ENTRIES\n\n## Added\nINSERT ENTRIES\n\n';
  commitsAsArrayOfMaps.forEach(function(map) {
    var pr = map[PR_NUM].replace('^[d]', '');
    var message =
      '- ' +
      map[MESSAGE].trim() +
      ' ([PR #' +
      pr +
      ']' +
      '(https://github.com/forcedotcom/salesforcedx-vscode/pull/' +
      pr +
      '))\n';
    map[PACKAGES].forEach(function(packageName) {
      text += '#### ' + packageName + '\n' + message;
    });
  });
  return text;
}

/**
 * Prints the message to the error stream and exits the script.
 */
function exitWithError(errorMessage) {
  process.stderr.write(errorMessage + '\n');
  process.exit(-1);
}

var releaseBranch = getReleaseBranch();
validateReleaseBranch(releaseBranch);
getNewChangeLogBranch(releaseBranch);

var commitsAsArrayOfMaps = getCommitsAsListOfMaps();
var result = getChangeLog(releaseBranch, commitsAsArrayOfMaps);
console.log(
  '\nInsert the following changes into ' + CHANGE_LOG_PATH + ':\n' + result
);
