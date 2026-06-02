#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Blocks `npm install` when run directly inside a package directory.
// INIT_CWD (set by npm) is where the user invoked the command.
// process.cwd() is the package dir npm cd'd into to run this preinstall.
// They are equal only when npm install was invoked from inside the package.
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
if (path.resolve(process.env.INIT_CWD || '') !== repoRoot) {
  console.error('ERROR: Run `npm install` from the repo root, not from a package directory.');
  process.exit(1);
}
