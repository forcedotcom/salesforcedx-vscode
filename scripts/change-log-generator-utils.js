const constants = require('./change-log-constants');

// Commit Map Keys
const PR_NUM = 'PR_NUM';
const COMMIT = 'COMMIT';
const TYPE = 'TYPE';
const MESSAGE = 'MESSAGE';
const FILES_CHANGED = 'FILES_CHANGED';
const PACKAGES = 'PACKAGES';
const PR_ALREADY_EXISTS_ERROR =
  'Filtered PR number %s. An entry already exists in the changelog.';

module.exports = {
  getPreviousReleaseBranch, parseCommits, getMessagesGroupedByPackage, getChangeLogText, writeChangeLog
}

function getPreviousReleaseBranch(releaseBranch) {
  const releaseBranches = getReleaseBranches();
  const index = releaseBranches.indexOf(releaseBranch);
  if (index != -1 && index + 1 < releaseBranches.length) {
    return releaseBranches[index + 1];
  } else {
    console.log('Unable to retrieve previous release. Exiting.');
    process.exit(-1);
  }
}

/**
 * Returns a list of remote release branches, sorted in reverse order by
 * creation date. This ensures that the first entry is the latest branch.
 */
 function getReleaseBranches() {
  return shell
    .exec(
      `git branch --remotes --list --sort='-creatordate' '${constants.RELEASE_BRANCH_PREFIX}*'`,
      { silent: true }
    )
    .replace(/\n/g, ',')
    .split(',')
    .map(Function.prototype.call, String.prototype.trim);
}

/**
 * This command will list all commits that are different between
 * the two branches. Therefore, we are guaranteed to get all new
 * commits relevant only to the new branch.
 */
 function getCommits(releaseBranch, previousBranch) {
  const commits = shell
    .exec(
      `git log --cherry-pick --oneline ${releaseBranch}...${previousBranch}`,
      {
        silent: false
      }
    )
    .stdout.trim()
    .split('\n');
  return commits;
}

/**
 * Parse the commits and return them as a list of hashmaps.
 */
 function parseCommits(commits) {
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
  parsedCommits.forEach(function(map) {
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
 */
 function getMessagesGroupedByPackage(parsedCommits) {
  let groupedMessages = {};
  let sortedMessages = {};
  parsedCommits.forEach(function(map) {
    map[PACKAGES].forEach(function(packageName) {
      const key = generateKey(packageName, map[TYPE]);
      if (key) {
        groupedMessages[key] = groupedMessages[key] || [];
        groupedMessages[key].push(
          util.format(MESSAGE_FORMAT, map[MESSAGE], map[PR_NUM], map[PR_NUM])
        );
      }
    });
  });
  Object.keys(groupedMessages)
    .sort()
    .forEach(function(key) {
      sortedMessages[key] = groupedMessages[key];
    });
  return sortedMessages;
}

function getChangeLogText(releaseBranch, groupedMessages) {
  let changeLogText = util.format(
    LOG_HEADER,
    releaseBranch.toString().replace(constants.RELEASE_BRANCH_PREFIX, ''),
    getReleaseDate()
  );
  let lastType = '';
  Object.keys(groupedMessages).forEach(function(typeAndPackageName) {
    let [type, packageName] = typeAndPackageName.split('|');
    if (!lastType || lastType != type) {
      changeLogText += util.format(TYPE_HEADER, type);
      lastType = type;
    }
    changeLogText += util.format(SECTION_HEADER, packageName);
    groupedMessages[typeAndPackageName].forEach(function(message) {
      changeLogText += message;
    });
  });
  return changeLogText + '\n';
}


function writeChangeLog(textToInsert) {
  let data = fs.readFileSync(constants.CHANGE_LOG_PATH);
  let fd = fs.openSync(constants.CHANGE_LOG_PATH, 'w+');
  let buffer = Buffer.from(textToInsert.toString());
  fs.writeSync(fd, buffer, 0, buffer.length, 0);
  fs.writeSync(fd, data, 0, data.length, buffer.length);
  fs.closeSync(fd);
  console.log(`\nChange log written to: ${constants.CHANGE_LOG_PATH}`);
}