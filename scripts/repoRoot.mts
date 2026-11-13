#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Shared helper for locating the repo root from any CWD. Used by changelog scripts that
 * read/write files at fixed repo-relative paths (root CHANGELOG.md, packages/.../CHANGELOG.md).
 */

import { execSync } from 'node:child_process';

export const getRepoRoot = () => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    console.error('Error: Not in a git repository');
    process.exit(1);
  }
};
