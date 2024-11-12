const constants = require('./change-log-constants');
const fs = require('fs');
const shell = require('shelljs');
const util = require('util');

// Commit Map Keys
const PR_NUM = 'PR_NUM';
const LOG_HEADER = '# %s - %s\n';
const COMMIT = 'COMMIT';
const TYPE = 'TYPE';
const MESSAGE = 'MESSAGE';
const FILES_CHANGED = 'FILES_CHANGED';
const PACKAGES = 'PACKAGES';
const TYPE_HEADER = '\n## %s\n';
const SECTION_HEADER = '\n#### %s\n';
const MESSAGE_FORMAT = '\n- %s ([PR #%s](https://github.com/forcedotcom/salesforcedx-vscode/pull/%s))\n';
const PR_ALREADY_EXISTS_ERROR = 'Filtered PR number %s. An entry already exists in the changelog.';

const typesToIgnore = ['chore', 'style', 'refactor', 'test', 'build', 'ci', 'revert'];

const logger = (msg, obj) => {
  if (!obj) {
    console.log(`*** ${msg}`);
  } else {
    console.log(`*** ${msg}`, obj);
  }
};

/**
 * Returns the previous release branch
 * @returns
 */

function getPreviousReleaseBranch() {
  const releaseBranches = getRemoteReleaseBranches();
  return releaseBranches[0];
}

/**
 * Returns a list of remote release branches, sorted in reverse order by
 * creation date. This ensures that the first entry is the latest branch.
 */
function getRemoteReleaseBranches() {
  return shell
    .exec(`git branch --remotes --list --sort='-creatordate' '${constants.REMOTE_RELEASE_BRANCH_PREFIX}*'`, {
      silent: false
    })
    .replace(/\n/g, ',')
    .split(',')
    .map(Function.prototype.call, String.prototype.trim);
}

/**
 * This command will list all commits that are different between
 * the two branches. Therefore, we are guaranteed to get all new
 * commits relevant only to the new branch.
 * @param {string} releaseBranch
 * @param {string} previousBranch
 * @returns
 */
function getCommits(releaseBranch, previousBranch) {
  logger(`\nStep 3: Get commits from ${previousBranch} to ${releaseBranch}`);
  const commits = shell
    .exec(`git log --cherry-pick --oneline ${releaseBranch}...${previousBranch}`, {
      silent: false
    })
    .stdout.trim()
    .split('\n');
  return commits;
}

/**
 * Parse the commits and return them as a list of hashmaps.
 * @param {string[]} commits
 * @returns
 */
function parseCommits(commits) {
  logger(`\nStep 4: Determine which commits we want to share in the changelog`);
  let commitMaps = [];
  for (let i = 0; i < commits.length; i++) {
    const commitMap = buildMapFromCommit(commits[i]);
    if (commitMap && Object.keys(commitMap).length > 0) {
      commitMaps.push(commitMap);
    }
  }
  return filterExistingPREntries(commitMaps);
}

function buildMapFromCommit(commit) {
  let map = {};
  if (commit) {
    let pr = constants.PR_REGEX.exec(commit);
    let commitNum = constants.COMMIT_REGEX.exec(commit);
    if (pr && commitNum) {
      let message = commit.replace(commitNum[0], '').replace(pr[0], '');
      let type = constants.TYPE_REGEX.exec(message);
      map[PR_NUM] = pr[0].replace(/[^\d]/g, '');
      map[COMMIT] = commitNum[0];
      if (type) {
        map[TYPE] = type[1];
        message = message.replace(type[0], '');
      }
      message = message.trim();
      map[MESSAGE] = message.charAt(0).toUpperCase() + message.slice(1);
      map[FILES_CHANGED] = getFilesChanged(map[COMMIT]);
      map[PACKAGES] = getPackageHeaders(map[FILES_CHANGED]);
    }
  }

  console.log('\nCommit: ' + commit);
  console.log('Commit Map:');
  console.log(map);

  return map;
}

function filterExistingPREntries(parsedCommits) {
  let currentChangeLog = fs.readFileSync(constants.CHANGE_LOG_PATH);
  let filteredResults = [];
  parsedCommits.forEach(function (map) {
    if (!currentChangeLog.includes('PR #' + map[PR_NUM])) {
      filteredResults.push(map);
    } else {
      console.log('\n' + util.format(PR_ALREADY_EXISTS_ERROR, map[PR_NUM]));
    }
  });
  return filteredResults;
}

/**
 * Groups all messages per package header so they can be displayed under
 * the same package header subsection. Returns a map of lists.
 * @param {string[]} parsedCommits array of parsed commit
 * @param {string} packagesToIgnore comma separated list of packages to be ignored for changelog generation
 * @returns
 */
function getMessagesGroupedByPackage(parsedCommits, packagesToIgnore) {
  let groupedMessages = {};
  let sortedMessages = {};
  parsedCommits.forEach(function (map) {
    map[PACKAGES].forEach(function (packageName) {
      const key = generateKey(packageName, map[TYPE], packagesToIgnore);
      if (key) {
        groupedMessages[key] = groupedMessages[key] || [];
        groupedMessages[key].push(util.format(MESSAGE_FORMAT, map[MESSAGE], map[PR_NUM], map[PR_NUM]));
      }
    });
  });
  Object.keys(groupedMessages)
    .sort()
    .forEach(function (key) {
      sortedMessages[key] = groupedMessages[key];
    });
  return sortedMessages;
}

/**
 * Returns formatted change log
 * @param {string} releaseBranch
 * @param {string[]} groupedMessages
 * @returns
 */
function getChangeLogText(releaseBranch, groupedMessages) {
  let changeLogText = util.format(
    LOG_HEADER,
    releaseBranch.toString().replace(constants.REMOTE_RELEASE_BRANCH_PREFIX, ''),
    getReleaseDate()
  );
  let lastType = '';
  Object.keys(groupedMessages).forEach(function (typeAndPackageName) {
    let [type, packageName] = typeAndPackageName.split('|');
    if (!lastType || lastType != type) {
      changeLogText += util.format(TYPE_HEADER, type);
      lastType = type;
    }
    changeLogText += util.format(SECTION_HEADER, packageName);
    groupedMessages[typeAndPackageName].forEach(function (message) {
      changeLogText += message;
    });
  });
  return changeLogText + '\n';
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
  let packageHeaders = new Set();
  filesChanged.split(',').forEach(function (filePath) {
    const packageName = getPackageName(filePath);
    if (packageName) {
      packageHeaders.add(packageName);
    }
  });
  return filterPackageNames(packageHeaders);
}

/**
 * Write changelog to file
 * @param {string} textToInsert
 */
function writeChangeLog(textToInsert) {
  logger(`\nStep 5: Adding changelog to: ${constants.CHANGE_LOG_PATH}`);
  let data = fs.readFileSync(constants.CHANGE_LOG_PATH);
  let fd = fs.openSync(constants.CHANGE_LOG_PATH, 'w+');
  let buffer = Buffer.from(textToInsert.toString());
  fs.writeSync(fd, buffer, 0, buffer.length, 0);
  fs.writeSync(fd, data, 0, data.length, buffer.length);
  fs.closeSync(fd);
}

function getPackageName(filePath) {
  if (filePath && !filePath.includes('/images/') && !filePath.includes('/test/')) {
    let packageName = filePath.replace('packages/', '').split('/')[0];
    return packageName.startsWith('salesforce') || packageName.startsWith('docs') ? packageName : null;
  }
  return null;
}

function filterPackageNames(packageHeaders) {
  let filteredHeaders = new Set(packageHeaders);
  if (packageHeaders.has('salesforcedx-vscode-core')) {
    packageHeaders.forEach(function (packageName) {
      if (packageName != 'salesforcedx-vscode-core' && packageName != 'docs') {
        filteredHeaders.delete(packageName);
      }
    });
  }
  return filteredHeaders;
}

/**
 *
 * Generate the key to be used in the grouped messages map. This will help us
 * determine whether this is an addition or fix, along with the package header
 * that the commit should be inserted under.
 *
 * @param {string} packageName Name of the package within the extensions repo
 * @param {string} type Type of the commit
 * @param {string} packagesToIgnore  Name of the packages (comma separated) that we don't need changelog generated
 * @returns
 */
function generateKey(packageName, type, packagesToIgnore) {
  if (
    typesToIgnore.some(typeToIgnore => !type || type.startsWith(typeToIgnore)) ||
    packagesToIgnore.includes(packageName)
  ) {
    return '';
  }
  const keyPrefix = type === 'feat' ? 'Added' : 'Fixed';
  return `${keyPrefix}|${packageName}`;
}

function getReleaseDate() {
  // We want to ideally release two days from the day the release branch is cut
  // (typically branch cut happens Monday and release on Wednesday)
  let releaseDate = new Date();
  releaseDate.setDate(releaseDate.getDate() + 2);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(releaseDate);
}

/**
 *
 * Complete the heavy lifting to update the changelog by grabbing the
 * new commits, grouping everything, and creating the text for editing.
 * @param {string} remoteReleaseBranch
 * @param {string} remotePreviousBranch
 */

function updateChangeLog(remoteReleaseBranch, remotePreviousBranch) {
  const parsedCommits = parseCommits(getCommits(remoteReleaseBranch, remotePreviousBranch));
  if (parsedCommits.length > 0) {
    const localReleaseBranch = remoteReleaseBranch.replace(constants.ORIGIN_PREFIX_ONLY, '');
    console.log(`\nChecking out ${localReleaseBranch}`);
    const commitCommand = `git checkout ${localReleaseBranch}`;
    shell.exec(commitCommand);

    const groupedMessages = getMessagesGroupedByPackage(parsedCommits, '');
    const changeLog = getChangeLogText(remoteReleaseBranch, groupedMessages);
    writeChangeLog(changeLog);
  } else {
    console.log(`No commits found, so we can skip this week's release. Carry on!`);
    process.exit(0);
  }
}

module.exports = {
  getPreviousReleaseBranch,
  updateChangeLog
};
