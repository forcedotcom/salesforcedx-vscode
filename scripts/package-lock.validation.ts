/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert';
import lockfile from '../package-lock.json';

assert.deepStrictEqual(
  Object.entries(lockfile.packages)
    .filter(([key]) => key.startsWith('node_modules'))
    .filter(([, value]) => !('link' in value) && !('inBundle' in value))
    .filter(([, value]) => !('integrity' in value) || !('resolved' in value)),
  [],
  'integrity/resolved property is missing in package-lock.json.  see npm bug https://github.com/npm/cli/issues/4263.  copy the lockfile from the default branch and node_modules and re-run npm install.'
);
console.log('Package lock file is valid');
