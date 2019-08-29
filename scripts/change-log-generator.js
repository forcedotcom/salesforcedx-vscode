/*
 * Automates the process of building the change log for releases.
 *
 * Assumptions:
 * 1. You have shelljs installed globally using `npm install -g shelljs`.
 * 2. The release branch in question has already been cut.
 * 3. readline-sync is installed using 'npm install readline-sync'
 *
 * This does not currently take into consideration:
 * 1. External contributions
 * 2. Duplicates (ex file changes made in both salesforcedx-apex-debugger and salesforcedx-apex-replay-debugger)
 * 3. Non-salesforce package contributions aside from doc updates
 * 4. Situations where we should not be adding the entry in the changelog
 * 5. Adding vs. Fixed
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
const GIT_HUB_URL = 'https://github.com/forcedotcom/salesforcedx-vscode/pull/';

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
  process.stdout.write('Using release branch: ' + releaseBranch + '\n');
}

function getNewChangeLogBranch(releaseBranch) {
  var changeLogBranch = CHANGE_LOG_BRANCH + releaseBranch;
  shell.exec(
    'git checkout -b ' +
      changeLogBranch +
      path.join('release', 'v' + releaseBranch)
  );
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
    .split('Updated SHA256', 1)
    .toString()
    .split('\n');
  console.log('commits: ' + commits);
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
      map[PACKAGES] = getPackageHeaders(map[FILES]);
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

// TODO - breakup into smaller pieces
function getPackageHeaders(filesChanged) {
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
        var packageName = filePath.replace('packages/', '').split('/')[0];
        if (packageName.startsWith('salesforce')) {
          packageHeaders.add(packageName);
        }
      }
    }
  });
  if (packageHeaders.has('salesforcedx-vscode-core')) {
    packageHeaders.forEach(function(packageName) {
      if (packageName != 'salesforcedx-vscode-core' && packageName != 'docs') {
        packageHeaders.delete(packageName);
      }
    });
  }
  return packageHeaders;
}

// TODO - would like to change this to something similar to how messages are generated.
// This way we're only replacing pieces of a standard format.
// TODO - documentation
function getChangeLog(releaseBranch, commitsAsArrayOfMaps) {
  var text =
    releaseBranch.toString().replace('\n', '') +
    ' - (INSERT RELEASE DATE [Month Day, Year])\n' +
    '\n## Fixed\nINSERT ENTRIES\n\n## Added\nINSERT ENTRIES\n\n';
  var messagesByPackage = {};

  Object.values(commitsAsArrayOfMaps).forEach(function(commitMap) {
    var message = buildChangeLogLine(commitMap);
    commitMap[PACKAGES].forEach(function(packageName) {
      messagesByPackage[packageName] = messagesByPackage[packageName] || [];
      messagesByPackage[packageName].push(message);
    });
  });

  Object.keys(messagesByPackage).forEach(function(packageName) {
    text += '\n#### ' + packageName + '\n';
    Object.values(messagesByPackage[packageName]).forEach(function(message) {
      text += message;
    });
  });
  return text;
}

function buildChangeLogLine(map) {
  var pr = map[PR_NUM].replace(/[^\d]/g, '');
  return (
    '- ' +
    map[MESSAGE].trim() +
    ' ([PR #' +
    pr +
    ']' +
    '(' +
    GIT_HUB_URL +
    pr +
    '))\n'
  );
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
