#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const path = require('path');
const repoRoot = path.resolve(__dirname, '..');

const enforceRootInstall = invocationDirectory => {
  if (path.resolve(invocationDirectory || '') !== repoRoot) {
    throw new Error('Run `pnpm install` from the repo root, not from a package directory.');
  }
};

if (require.main === module) {
  try {
    enforceRootInstall(process.env.INIT_CWD);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { enforceRootInstall };
