#!/usr/bin/env node
/*
 * Automates the process of building the change log for releases.
 *
 * Assumptions:
 * 1. You have shelljs installed globally using `npm install -g shelljs`.
 * 2. The release branch in question has already been cut.
 *
 * This does not currently take into consideration:
 * 1. External contributions
 * 2. Duplicates (ex file changes made in both salesforcedx-apex-debugger and salesforcedx-apex-replay-debugger)
 * 3. Non-salesforce package contributions aside from doc updates
 * 4. Adding vs. Fixed vs. Ignore in change log
 *
 * Overriding Default Values:
 * 1. Override the release. Example: npm run build-change-log -- -r 46.7.0
 * 2. Add verbose logging. Example: npm run build-change-log -- -v
 */

const process = require('process');
const path = require('path');
const shell = require('shelljs');
const fs = require('fs');
const util = require('util');

shell.set('-e');
shell.set('+v');

// Commands
const GIT_BRANCH =
  "git branch --remotes --list --sort='-creatordate' 'origin/release/v*'";
const GIT_CHECKOUT = 'git checkout -b %s %s';
const GIT_LOG = 'git log --cherry-pick --oneline %s...%s';

// Constants
const CHANGE_LOG_PATH = path.join(
  process.cwd(),
  'packages',
  'salesforcedx-vscode',
  'CHANGELOG.md'
);
const CHANGE_LOG_BRANCH = 'changeLog-v';

// Text Values
const RELEASE_MESSAGE = 'Using Release Branch: %s\nPrevious Release Branch: %s';
const LOG_HEADER = '# %s - Month DD, YYYY\n';
const FIXED_HEADER = '\n## Fixed\n';
const ADDED_HEADER = '\n\n## Added\n';
const SECTION_HEADER = '\n#### %s\n';
const MESSAGE_FORMAT =
  '\n- %s ([PR #%s](https://github.com/forcedotcom/salesforcedx-vscode/pull/%s))\n';
const PR_ALREADY_EXISTS_ERROR =
  'Filtered PR number %s. An entry already exists in the changelog.';

// Commit Map Keys
const PR_NUM = 'PR NUM';
const COMMIT = 'COMMIT';
const TYPE = 'TYPE';
const MESSAGE = 'MESSAGE';
const FILES_CHANGED = 'FILES_CHANGED';
const PACKAGES = 'PACKAGES';

// Regex
const RELEASE_REGEX = new RegExp(/^origin\/release\/v\d{2}\.\d{1,2}\.\d/);
const PR_REGEX = new RegExp(/(\(#\d+\))/);
const COMMIT_REGEX = new RegExp(/^([\da-zA-Z]+)/);
const TYPE_REGEX = new RegExp(/([a-zA-Z]+):/);

/**
 * Checks if the user has provided a release branch override. If they
 * have not, returns the latest release branch.
 */
function getReleaseBranch() {
  var releaseIndex = process.argv.indexOf('-r');
  var releaseBranch =
    releaseIndex > -1 && process.argv[releaseIndex + 1]
      ? 'origin/release/v' + process.argv[releaseIndex + 1]
      : getReleaseBranches()[0];
  validateReleaseBranch(releaseBranch);
  return releaseBranch;
}

/**
 * Returns a list of remote release branches, sorted in reverse order by
 * creation date. This ensures that the first entry is the latest branch.
 */
function getReleaseBranches() {
  return shell
    .exec(GIT_BRANCH, { silent: true })
    .replace(/\n/g, ',')
    .split(',')
    .map(Function.prototype.call, String.prototype.trim);
}

function getPreviousReleaseBranch(releaseBranch) {
  var releaseBranches = getReleaseBranches();
  var index = releaseBranches.indexOf(releaseBranch);
  if (index != -1 && index + 1 < releaseBranches.length) {
    return releaseBranches[index + 1];
  } else {
    console.log('Unable to retrieve previous release. Exiting.');
    process.exit(-1);
  }
}

function validateReleaseBranch(releaseBranch) {
  if (!(releaseBranch && RELEASE_REGEX.exec(releaseBranch))) {
    console.log(
      "Invalid release '" + releaseBranch + "'. Expected format [xx.yy.z]."
    );
    process.exit(-1);
  }
}

function getNewChangeLogBranch(releaseBranch) {
  var changeLogBranch =
    CHANGE_LOG_BRANCH + releaseBranch.replace('origin/release/v', '');
  shell.exec(util.format(GIT_CHECKOUT, changeLogBranch, releaseBranch));
}

/**
 * This command will list all commits that are different between
 * the two branches. Therefore, we are guaranteed to get all new
 * commits relevant only to the new branch.
 */
function getCommits(releaseBranch, previousBranch) {
  if (ADD_VERBOSE_LOGGING) console.log('\nCommits:');
  var commits = shell
    .exec(util.format(GIT_LOG, releaseBranch, previousBranch), {
      silent: !ADD_VERBOSE_LOGGING
    })
    .stdout.trim()
    .split('\n');
  return commits;
}

/**
 * Parse the commits and return them as a list of hashmaps.
 */
function parseCommits(commits) {
  if (ADD_VERBOSE_LOGGING) console.log('\nCommit Parsing Results...');
  var commitMaps = [];
  for (var i = 0; i < commits.length; i++) {
    var commitMap = buildMapFromCommit(commits[i]);
    if (commitMap && Object.keys(commitMap).length > 0) {
      commitMaps.push(commitMap);
    }
  }
  return filterExistingPREntries(commitMaps);
}

function buildMapFromCommit(commit) {
  var map = {};
  if (commit) {
    var pr = PR_REGEX.exec(commit);
    var commitNum = COMMIT_REGEX.exec(commit);
    if (pr && commitNum) {
      var message = commit
        .replace(commitNum[0], '')
        .replace(pr[0], '')
        .trim();
      var type = TYPE_REGEX.exec(message);
      map[PR_NUM] = pr[0].replace(/[^\d]/g, '');
      map[COMMIT] = commitNum[0];
      if (type) {
        map[TYPE] = type[0];
        message = message.replace(type[0], '');
      }
      map[MESSAGE] = message;
      map[FILES_CHANGED] = getFilesChanged(map[COMMIT]);
      map[PACKAGES] = getPackageHeaders(map[FILES_CHANGED]);
    }
  }
  if (ADD_VERBOSE_LOGGING) {
    console.log('\nCommit: ' + commit);
    console.log('Commit Map:');
    console.log(map);
  }
  return map;
}

function getFilesChanged(commitNumber) {
  return shell
    .exec('git show --pretty="" --name-only ' + commitNumber, {
      silent: true
    })
    .stdout.trim()
    .toString()
    .replace(/\n/g, ',');
}

function getPackageHeaders(filesChanged) {
  var packageHeaders = new Set();
  filesChanged.split(',').forEach(function(filePath) {
    var packageName = getPackageName(filePath);
    if (packageName) {
      packageHeaders.add(packageName);
    }
  });
  return filterPackageNames(packageHeaders);
}

function getPackageName(filePath) {
  if (
    filePath &&
    !filePath.includes('/images/') &&
    !filePath.includes('/test/')
  ) {
    var packageName = filePath.replace('packages/', '').split('/')[0];
    return packageName.startsWith('salesforce') ||
      packageName.startsWith('docs')
      ? packageName
      : null;
  }
  return null;
}

function filterPackageNames(packageHeaders) {
  var filteredHeaders = new Set(packageHeaders);
  if (packageHeaders.has('salesforcedx-vscode-core')) {
    packageHeaders.forEach(function(packageName) {
      if (packageName != 'salesforcedx-vscode-core' && packageName != 'docs') {
        filteredHeaders.delete(packageName);
      }
    });
  }
  return filteredHeaders;
}

function filterExistingPREntries(parsedCommits) {
  var currentChangeLog = fs.readFileSync(CHANGE_LOG_PATH);
  var filteredResults = [];
  parsedCommits.forEach(function(map) {
    if (!currentChangeLog.includes('PR #' + map[PR_NUM])) {
      filteredResults.push(map);
    } else if (ADD_VERBOSE_LOGGING) {
      console.log('\n' + util.format(PR_ALREADY_EXISTS_ERROR, map[PR_NUM]));
    }
  });
  return filteredResults;
}

/**
 * Groups all messages per package header so they can be displayed under
 * the same package header subsection. Returns a map of lists.
 */
function getMessagesGroupedByPackage(parsedCommits) {
  var groupedMessages = {};
  parsedCommits.forEach(function(map) {
    map[PACKAGES].forEach(function(packageName) {
      groupedMessages[packageName] = groupedMessages[packageName] || [];
      groupedMessages[packageName].push(
        util.format(MESSAGE_FORMAT, map[MESSAGE], map[PR_NUM], map[PR_NUM])
      );
    });
  });
  if (ADD_VERBOSE_LOGGING) {
    console.log('\nMessages grouped by package:');
    console.log(groupedMessages);
  }
  return groupedMessages;
}

function getChangeLogText(releaseBranch, groupedMessages) {
  var changeLogText = util.format(
    LOG_HEADER,
    releaseBranch.toString().replace('origin/release/v', '')
  );
  Object.keys(groupedMessages).forEach(function(packageName) {
    changeLogText += util.format(SECTION_HEADER, packageName);
    groupedMessages[packageName].forEach(function(message) {
      changeLogText += message;
    });
  });
  return changeLogText + '\n';
}

function writeChangeLog(textToInsert) {
  var data = fs.readFileSync(CHANGE_LOG_PATH);
  var fd = fs.openSync(CHANGE_LOG_PATH, 'w+');
  var buffer = Buffer.from(textToInsert.toString());
  fs.writeSync(fd, buffer, 0, buffer.length, 0);
  fs.writeSync(fd, data, 0, data.length, buffer.length);
  fs.closeSync(fd);
}

function writeAdditionalInfo() {
  console.log('\nChange log written to: ' + CHANGE_LOG_PATH + '\n');
  console.log('Next Steps:');
  console.log("  1) Remove entries that shouldn't be included in the release.");
  console.log('  2) Add documentation links as needed.');
  console.log(
    '     Format: [Doc Title](https://forcedotcom.github.io/salesforcedx-vscode/articles/doc-link-here)'
  );
  console.log("  3) Move entries to the 'Added' or 'Fixed' section header.");
  console.log('  4) Commit, push, and open your PR for team review.');
}

console.log("Starting script 'change-log-generator'\n");

let ADD_VERBOSE_LOGGING = process.argv.indexOf('-v') > -1 ? true : false;
var releaseBranch = getReleaseBranch();
var previousBranch = getPreviousReleaseBranch(releaseBranch);
console.log(util.format(RELEASE_MESSAGE, releaseBranch, previousBranch));
// getNewChangeLogBranch(releaseBranch);

var parsedCommits = parseCommits(getCommits(releaseBranch, previousBranch));
var groupedMessages = getMessagesGroupedByPackage(parsedCommits);
var changeLog = getChangeLogText(releaseBranch, groupedMessages);
writeChangeLog(changeLog);
writeAdditionalInfo();
