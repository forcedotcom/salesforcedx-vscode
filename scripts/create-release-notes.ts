import * as shell from 'shelljs';
const changeLogGeneratorUtils = require('./change-log-generator-utils');
const constants = require('./change-log-constants');

const [_, __, releaseOverride] = process.argv

const logger = (msg: string, obj?: any) => {
  if (!obj) {
    console.log(`*** ${msg}`);
  } else {
    console.log(`*** ${msg}`, obj);
  }
};

/**
 * Checks if the user has provided a release branch override. If they
 * have not, return the latest release branch.
 */
function getReleaseBranch() {
  logger('\nStep 1: Determine release branch.');
  const releaseBranchArg = releaseOverride;
  console.log(`releaseOverride is ${releaseBranchArg}`);
  const releaseBranch = releaseBranchArg
    ? constants.REMOTE_RELEASE_BRANCH_PREFIX + releaseBranchArg
    : getReleaseBranches()[0];
  validateReleaseBranch(releaseBranch);
  logger(`\nLast release branch was: ${releaseBranch}`)
  return releaseBranch;
}

/**
 * Returns a list of remote release branches, sorted in reverse order by
 * creation date. This ensures that the first entry is the latest branch.
 */
function getReleaseBranches() {
  return shell
    .exec(
      `git branch --remotes --list --sort='-creatordate' '${constants.REMOTE_RELEASE_BRANCH_PREFIX}*'`,
      { silent: true }
    )
    .replace(/\n/g, ',')
    .split(',')
    .map(Function.prototype.call, String.prototype.trim);
}

/**
 * Confirms the release branch has been created.
 */
function validateReleaseBranch(releaseBranch) {
  if (!(releaseBranch && constants.RELEASE_REGEX.exec(releaseBranch))) {
    console.log(
      "Invalid release '" + releaseBranch + "'. Expected format [xx.yy.z]."
    );
    process.exit(-1);
  }
}

const releaseBranchName = getReleaseBranch();
const latestReleasedTag = String(shell.exec(`git describe --tags --abbrev=0`));
const latestReleasedBranchName = `origin/release/${latestReleasedTag}`;
logger(`\nLatest release branch was: ${latestReleasedBranchName}`);

changeLogGeneratorUtils.updateChangeLog(releaseBranchName, latestReleasedBranchName);

process.exit(0);