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

  // Regex
  RELEASE_REGEX: new RegExp(/^origin\/release\/v\d{2}\.\d{1,2}\.\d/),
  PR_REGEX: new RegExp(/(\(#\d+\))/),
  COMMIT_REGEX: new RegExp(/^([\da-zA-Z]+)/),
  TYPE_REGEX: new RegExp(/([a-zA-Z]+)(?:\([a-zA-Z]+\))?:/)
});
