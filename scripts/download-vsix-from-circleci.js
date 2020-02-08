#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const { getVsixName, getLocalPathForDownload } = require('./publish-utils');
const CIRCLECI_API_URI = 'https://circleci.com/api/v1.1';
const circleciToken = process.env['CIRCLECI_TOKEN'];
const circleciBuild = process.env['CIRCLECI_BUILD'];
const nextVersion = process.env['SALESFORCEDX_VSCODE_VERSION'];

// Check for CircleCI environment variables
if (!circleciBuild) {
  console.log(
    'You must specify the CircleCI Build number (CIRCLECI_BUILD) that contains the artifacts that will be released.'
  );
  process.exit(-1);
}

if (!circleciToken) {
  console.log(
    'You must specify the CircleCI Token (CIRCLECI_TOKEN) that will allow us to get the artifacts that will be released.'
  );
  process.exit(-1);
}

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
  console.log(
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
  console.log(
    'Looks like your CircleCI Token does not grant you access to the salesforcedx-vscode builds'
  );
  process.exit(-1);
}

// Get artifact names from CircleCI build
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
  console.log(
    `Looks like the CircleCI build number ${circleciBuild} did not generate any artifacts`
  );
  process.exit(-1);
}

console.log(
  `There are ${buildArtifactsJSON.length} artifacts that will be processed ...`
);

// Real-clean
shell.exec('git clean -xfd -e node_modules');

// Download vsix files from CircleCI and save vsix files in their correct package/salesforcedx-vscode-... location
buildArtifactsJSON.forEach(artifactObj => {
  if (!artifactObj.path.includes(nextVersion)) {
    console.log(
      `Artifact ${artifactObj.path} does not belong to release ${nextVersion}`
    );
    process.exit(-1);
  }
  const artifactName = getVsixName(artifactObj.path);
  const downloadPath = getLocalPathForDownload(artifactName, nextVersion);

  console.log(`Downloading artifact ${artifactName} to ${downloadPath}`);
  // Download vsix files, fail if it takes more than 30 seconds to connect or if the download exceeds 2 mins
  shell.exec(
    `curl --fail ${
      artifactObj.url
    } --output ${downloadPath} --connect-timeout 30 --max-time 180`
  );
});
