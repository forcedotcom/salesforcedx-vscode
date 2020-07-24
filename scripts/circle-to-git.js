#!/usr/bin/env node

const path = require('path');
const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const GITHUB_API_URI = 'https://api.github.com';
const CIRCLECI_API_URI = 'https://circleci.com/api/v1.1';

const repo = process.env['CIRCLE_PROJECT_REPONAME'];
const username = process.env['CIRCLE_PROJECT_USERNAME'];
const prNumber = path.basename(
  process.env['CIRCLE_PULL_REQUEST'] || process.env['CI_PULL_REQUEST'] || ''
);
const circleBuildNum = process.env['CIRCLE_BUILD_NUM'];

// check if something is missing
const cciArtifacts = shell.exec(
  `curl ${CIRCLECI_API_URI}/project/github/AnanyaJha/salesforcedx-vscode/${circleBuildNum}/artifacts?circle-token=$CIRCLE_API_USER_TOKEN`
).stdout;
const buildArtifactsJSON = JSON.parse(cciArtifacts);
let text;

if (buildArtifactsJSON) {
  text = 'Here are the Circle CI artifacts for this build:<br>';
  buildArtifactsJSON.forEach(artifact => {
    const url = artifact.url;
    const extName = path.basename(artifact.url);
    const htmlLink = `<a href='${url}' target='_blank' download='extensions'>${extName}</a><br>`;
    text += htmlLink;
  });
} else {
  text = `Looks like your build did not generate any artifacts! Check out what happened <a href='$CIRCLE_BUILD_URL' target='_blank' download='extensions'>here</a><br>`;
}

shell.exec(
  `curl -H "Authorization: token $GH_AUTH_TOKEN" --silent POST --data '{"body": "${text}"}' ${GITHUB_API_URI}/repos/${username}/${repo}/issues/${prNumber}/comments`
);
