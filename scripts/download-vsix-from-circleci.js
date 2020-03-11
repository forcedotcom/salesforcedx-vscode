#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

/*
 * Assumptions:
 * 0. You have shelljs installed globally using `npm install -g shelljs`.
 * 1. The script is running locally and from the top-level directory for this project
 *
 * Instructions:
 * Run this script with SALESFORCEDX_VSCODE_VERSION, CIRCLECI_TOKEN & CIRCLECI_BUILD as environment variables
 * i.e. SALESFORCEDX_VSCODE_VERSION=x.y.z CIRCLECI_TOKEN=xyztoken CIRCLECI_BUILD=5 ./scripts/download-vsix-from-circleci.js
 *
 */

const { getVsixName, getLocalPathForDownload } = require('./publish-utils');
const { checkEnvironmentVariables } = require('./validation-utils');
const logger = require('./logger-util');
const CIRCLECI_API_URI = 'https://circleci.com/api/v1.1';
const circleciToken = process.env['CIRCLECI_TOKEN'];
const circleciBuild = process.env['CIRCLECI_BUILD'];
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];

checkEnvironmentVariables();

// Check access to CircleCI & the project's builds
const circleciMe = shell
  .exec(`curl ${CIRCLECI_API_URI}/me?circle-token=${circleciToken}`, {
    silent: true
  })
  .stdout.trim();

const circleciMeJSON = JSON.parse(circleciMe);
if (
  circleciMeJSON.hasOwnProperty('message') &&
  circleciMeJSON.message === 'You must log in first.'
) {
  logger.error(
    'Looks like your CircleCI Token is incorrect and does not grant you access'
  );
  process.exit(-1);
}

if (
  !circleciMeJSON.hasOwnProperty('projects') ||
  !circleciMeJSON.projects.hasOwnProperty(
    'https://github.com/forcedotcom/salesforcedx-vscode'
  )
) {
  logger.error(
    'Looks like your CircleCI Token does not grant you access to the salesforcedx-vscode builds.'
  );
  process.exit(-1);
}

logger.header('Get artifact names from CircleCI build.');
const cciArtifacts = shell
  .exec(
    `curl ${CIRCLECI_API_URI}/project/github/forcedotcom/salesforcedx-vscode/${circleciBuild}/artifacts?circle-token=${circleciToken}`,
    {
      silent: true
    }
  )
  .stdout.trim();

const buildArtifactsJSON = JSON.parse(cciArtifacts);
if (buildArtifactsJSON && buildArtifactsJSON.length === 0) {
  logger.error(
    `Looks like the CircleCI build number ${circleciBuild} did not generate any artifacts. Make sure you pick a build that is labeled build-all.`
  );
  process.exit(-1);
}

logger.info(
  `There are ${buildArtifactsJSON.length} artifacts that will be processed...`
);

// Real-clean
shell.exec('git clean -xfd -e node_modules');

logger.header(
  'Download vsix files from CircleCI and save vsix files in their correct package/salesforcedx-vscode-... location'
);
buildArtifactsJSON.forEach(artifactObj => {
  if (!artifactObj.path.includes(nextVersion)) {
    logger.error(
      `Artifact ${artifactObj.path} does not belong to release ${nextVersion}`
    );
    process.exit(-1);
  }
  const artifactName = getVsixName(artifactObj.path);
  const downloadPath = getLocalPathForDownload(artifactName, nextVersion);

  logger.info(`Downloading artifact ${artifactName} to ${downloadPath}`);
  // Download vsix files, fail if it takes more than 30 seconds to connect or if the download exceeds 2 mins
  shell.exec(
    `curl --fail ${artifactObj.url} --output ${downloadPath} --connect-timeout 30 --max-time 180`
  );
});
