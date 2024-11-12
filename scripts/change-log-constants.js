#!/usr/bin/env node

const path = require('path');

module.exports = Object.freeze({
  // Change Log Paths
  CHANGE_LOG_PATH: path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.md'),
  ORIGIN_PREFIX_ONLY: 'origin/',
  REMOTE_RELEASE_BRANCH_PREFIX: 'origin/release/v',
  REMOTE_RELEASE_BRANCH_PREFIX_NO_VERSION: 'origin/release',
  RELEASE_BRANCH_PREFIX: 'release/v',

  // Regex
  RELEASE_REGEX: new RegExp(/^origin\/release\/v\d{2}\.\d{1,2}\.\d/),
  PR_REGEX: new RegExp(/(\(#\d+\))/),
  COMMIT_REGEX: new RegExp(/^([\da-zA-Z]+)/),
  TYPE_REGEX: new RegExp(/([a-zA-Z]+)(?:\([a-zA-Z]+\))?:/)
});
