import * as shell from 'shelljs';
import { window, workspace, Uri } from 'vscode';
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
function getRemoteReleaseBranch() {
  logger('\nStep 1: Determine release branch.');
  let releaseBranch;
  if (!releaseOverride) {
    console.log(`releaseOverride not provided. Getting latest release.`);
    releaseBranch = getRemoteReleaseBranches()[0];
  } else {
    console.log(`releaseOverride set to ${releaseOverride}`);
    releaseBranch = constants.REMOTE_RELEASE_BRANCH_PREFIX + releaseOverride;
  }
  validateReleaseBranch(releaseBranch);
  console.log(`\nBranch to be released is: ${releaseBranch}`)
  return releaseBranch;
}

/**
 * Returns a list of remote release branches, sorted in reverse order by
 * creation date. This ensures that the first entry is the latest branch.
 */
function getRemoteReleaseBranches() {
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

const releaseBranchName = getRemoteReleaseBranch();
logger(`\nStep 2: Getting latest tag to compare last published version`);
const latestReleasedTag = String(shell.exec(`git describe --tags --abbrev=0`));
const latestReleasedBranchName = `origin/release/${latestReleasedTag}`;
validateReleaseBranch(latestReleasedBranchName);

changeLogGeneratorUtils.updateChangeLog(releaseBranchName, latestReleasedBranchName);
logger(`\nOpening changelog for review`);
shell.exec(`code-insiders ${constants.CHANGE_LOG_PATH} || code ${constants.CHANGE_LOG_PATH}`);

process.exit(0);