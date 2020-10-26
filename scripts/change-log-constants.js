#!/usr/bin/env node

const path = require('path');

module.exports = Object.freeze({
  // Change Log Paths
  CHANGE_LOG_PATH: path.join(
    process.cwd(),
    'packages',
    'salesforcedx-vscode',
    'CHANGELOG.md'
  ),
  CHANGE_LOG_BRANCH: 'changeLog-v',
  RELEASE_BRANCH_PREFIX: 'origin/release/v',

  // Map Keys
  PR_NUM: 'PR_NUM',
  COMMIT: 'COMMIT',
  MESSAGE: 'MESSAGE',
  FILES_CHANGED: 'FILES_CHANGED',
  PACKAGES: 'PACKAGES',

  // Regex
  RELEASE_REGEX: new RegExp(/^origin\/release\/v\d{2}\.\d{1,2}\.\d/),
  PR_REGEX: new RegExp(/(\(#\d+\))/),
  COMMIT_REGEX: new RegExp(/^([\da-zA-Z]+)/)
});
