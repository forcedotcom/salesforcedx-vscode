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

// Constants
const CHANGE_LOG_PATH = path.join(
  process.cwd(),
  'packages',
  'salesforcedx-vscode',
  'CHANGELOG.md'
);
const CHANGE_LOG_BRANCH = 'changeLog-v';

// Change log values
const LOG_HEADER =
  '# %s - (INSERT RELEASE DATE [Month Day, Year])\n' +
  '\n## Fixed\nMOVE ENTRIES FROM BELOW\n\n## Added\nMOVE ENTRIES FROM BELOW\n';
const SECTION_HEADER = '\n#### %s\n';
const MESSAGE_FORMAT =
  '\n- %s ([PR #%s](https://github.com/forcedotcom/salesforcedx-vscode/pull/%s))\n';

// Commit Map Keys
const PR_NUM = 'PR NUM';
const COMMIT = 'COMMIT';
const MESSAGE = 'MESSAGE';
const FILES = 'FILES';
const PACKAGES = 'PACKAGES';

// Regex
const RELEASE_REGEX = new RegExp(/^\d{2}\.\d{1,2}\.\d/);
const PR_REGEX = new RegExp(/(\(#\d+\))/);
const COMMIT_REGEX = new RegExp(/^([\da-zA-Z]+)/);

/**
 * Gets the latest release branch using git. Retrieves all remote branches
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
    .split(' ', 1)
    .toString()
    .replace('\n', '');
  process.stdout.write('Latest Release Branch: ' + latestReleaseBranch + '\n');
  return latestReleaseBranch;
}

function getReleaseBranch() {
  var releaseIndex = process.argv.indexOf('-r');
  if (releaseIndex > -1) {
    return process.argv[releaseIndex + 1];
  }
  return getLatestReleaseBranch();
}

function validateReleaseBranch(releaseBranch) {
  if (!(releaseBranch && RELEASE_REGEX.exec(releaseBranch))) {
    process.exit(-1);
    console.log(
      "Invalid release '" + releaseBranch + "'. Expected format [xx.yy.z]."
    );
  }
  process.stdout.write('Using release branch: ' + releaseBranch + '\n\n');
}

function getNewChangeLogBranch(releaseBranch) {
  var changeLogBranch = CHANGE_LOG_BRANCH + releaseBranch;
  shell.exec(
    'git checkout -b ' + changeLogBranch + ' origin/release/v' + releaseBranch
  );
}

function getChangeLogText(releaseBranch) {
  var changeLogText = util.format(LOG_HEADER, releaseBranch.toString());
  var messagesByPackage = getMessagesPerPackage();
  Object.keys(messagesByPackage).forEach(function(packageName) {
    changeLogText += util.format(SECTION_HEADER, packageName);
    messagesByPackage[packageName].forEach(function(message) {
      changeLogText += message;
    });
  });
  return changeLogText + '\n';
}

/**
 * Groups all messages per package header so they can be displayed under
 * the same package header subsection. Returns a map of lists.
 */
function getMessagesPerPackage() {
  var messagesByPackage = {};
  parseCommits().forEach(function(commitMap) {
    var pr = commitMap[PR_NUM].replace(/[^\d]/g, '');
    commitMap[PACKAGES].forEach(function(packageName) {
      messagesByPackage[packageName] = messagesByPackage[packageName] || [];
      messagesByPackage[packageName].push(
        util.format(MESSAGE_FORMAT, commitMap[MESSAGE], pr, pr)
      );
    });
  });
  return messagesByPackage;
}

/**
 * Review the log and retrieve all of the commits specific to this
 * release. Parse this info and return it as a list of hashmaps.
 */
function parseCommits() {
  var results = [];
  var commits = shell
    .exec('git log --oneline', { silent: true })
    .stdout.trim()
    .split('Updated SHA256', 1)
    .toString()
    .split('\n');
  if (ADD_VERBOSE_LOGGING) console.log('\nCommit Parsing Results...');
  for (var i = 0; i < commits.length; i++) {
    var commitMap = buildMapFromCommit(commits[i]);
    if (commitMap && Object.keys(commitMap).length > 0) {
      results.push(commitMap);
    }
  }
  return results;
}

function buildMapFromCommit(commit) {
  var map = {};
  if (commit && !commit.includes('Merge branch')) {
    var pr = PR_REGEX.exec(commit);
    var commitNum = COMMIT_REGEX.exec(commit);
    if (pr && commitNum) {
      var message = commit.replace(commitNum[0], '').replace(pr[0], '');
      map[PR_NUM] = pr[0];
      map[COMMIT] = commitNum[0];
      map[MESSAGE] = message.trim();
      map[FILES] = getFilesChanged(map[COMMIT]);
      map[PACKAGES] = getPackageHeaders(map[FILES]);
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
  var packageHeader = '';
  var filesChanged = shell
    .exec('git show --pretty="" --name-only ' + commitNumber, { silent: true })
    .stdout.trim()
    .toString()
    .replace(/\n/g, ',');
  packageHeader = filesChanged;
  return packageHeader;
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

function writeChangeLog(releaseBranch) {
  var changelogText = getChangeLogText(releaseBranch);
  var data = fs.readFileSync(CHANGE_LOG_PATH);
  var fd = fs.openSync(CHANGE_LOG_PATH, 'w+');
  var buffer = Buffer.from(changelogText.toString());
  fs.writeSync(fd, buffer, 0, buffer.length, 0); //write new data
  fs.writeSync(fd, data, 0, data.length, buffer.length); //append old data
  fs.closeSync(fd);
}

console.log("Starting script 'change-log-generator'\n");
let ADD_VERBOSE_LOGGING = process.argv.indexOf('-v') > -1 ? true : false;
var releaseBranch = getReleaseBranch();
validateReleaseBranch(releaseBranch);
getNewChangeLogBranch(releaseBranch);
writeChangeLog(releaseBranch);

console.log('\nChange log has been written to ' + CHANGE_LOG_PATH + '\n');
console.log('Next Steps:');
console.log("  1) Remove entries that shouldn't be included in the release.");
console.log('  2) Add documentation links as needed.');
console.log(
  '     Format: [Doc Title](https://forcedotcom.github.io/salesforcedx-vscode/articles/doc-link-here)'
);
console.log("  3) Move entries to the 'Added' or 'Fixed' section header.");
console.log('  4) Commit, push, and open your PR for team review.');
