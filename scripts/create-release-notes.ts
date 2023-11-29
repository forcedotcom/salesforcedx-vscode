import * as changeLogGeneratorUtils from './change-log-generator-utils';
import * as constants from './change-log-constants';
import * as shell from 'shelljs';

const [_, __, releaseOverride] = process.argv;

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
function getCurrentRemoteReleaseBranch(): string {
  logger('\nStep 1: Determine release branch.');
  let releaseBranch;
  if (!releaseOverride) {
    console.log(`releaseOverride not provided. Getting latest release.`);
    releaseBranch = changeLogGeneratorUtils.getPreviousReleaseBranch();
  } else {
    console.log(`releaseOverride set to ${releaseOverride}`);
    releaseBranch = constants.REMOTE_RELEASE_BRANCH_PREFIX + releaseOverride;
  }
  validateReleaseBranch(releaseBranch);
  console.log(`\nBranch to be released is: ${releaseBranch}`);
  return releaseBranch;
}

/**
 * Gets the previous release branch from the latest Github tag information we have.
 */
function getPreviousRemoteReleaseBranch(): string {
  logger(`\nStep 2: Getting latest tag to compare last published version`);
  const latestReleasedTag = String(
    shell.exec(`git describe --tags --abbrev=0`),
  );
  const latestReleasedBranchName = `${constants.REMOTE_RELEASE_BRANCH_PREFIX_NO_VERSION}/${latestReleasedTag}`;
  validateReleaseBranch(latestReleasedBranchName);
  return latestReleasedBranchName;
}

/**
 * Confirms the release branch is in the correct format
 */
function validateReleaseBranch(releaseBranch): void {
  if (!(releaseBranch && constants.RELEASE_REGEX.exec(releaseBranch))) {
    console.log(
      "Invalid release '" + releaseBranch + "'. Expected format [xx.yy.z].",
    );
    process.exit(1);
  }
}

const currentReleaseBranchName = getCurrentRemoteReleaseBranch();
const previousReleaseBranchName = getPreviousRemoteReleaseBranch();
const releaseBranchName = currentReleaseBranchName.replace('origin/', '');

// switch to the current release branch
logger(`switch to the current release branch`);
shell.exec(`git checkout ${releaseBranchName}`);

changeLogGeneratorUtils.updateChangeLog(
  currentReleaseBranchName,
  previousReleaseBranchName,
);

// if running on github actions
if (process.env.GITHUB_ACTIONS) {
  logger(`\nCommit auto-generated changelog`);
  shell.exec(`git add ${constants.CHANGE_LOG_PATH}`);

  shell.exec(
    `git commit -m "chore: generated CHANGELOG for ${releaseBranchName}"`,
  );
  shell.exec(`git push -u origin ${releaseBranchName}`);
} else {
  logger(`\nOpening changelog for review`);
  //if code-insiders isn't yet set in the PATH or running user doesn't have insiders,
  //this will use VS Code instead
  shell.exec(
    `code-insiders ${constants.CHANGE_LOG_PATH} || code ${constants.CHANGE_LOG_PATH}`,
  );
}

process.exit(0);
