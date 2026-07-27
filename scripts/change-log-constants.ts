#!/usr/bin/env node

import path from 'node:path';

export const CHANGE_LOG_PATH = path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.md');
export const ORIGIN_PREFIX_ONLY = 'origin/';
export const REMOTE_RELEASE_BRANCH_PREFIX = 'origin/release/v';
export const REMOTE_RELEASE_BRANCH_PREFIX_NO_VERSION = 'origin/release';

// Regex
export const RELEASE_REGEX = /^origin\/release\/v\d{2}\.\d{1,2}\.\d/;
export const PR_REGEX = /(\(#\d+\))/;
export const COMMIT_REGEX = /^([\da-zA-Z]+)/;
export const TYPE_REGEX = /([a-zA-Z]+)(?:\([^)]*\))?:/;
export const GUS_WI_REGEX = /\[W-\d+\]\s*/g;
