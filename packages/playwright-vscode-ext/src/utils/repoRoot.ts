/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Resolves the repository root directory by traversing up from a starting directory
 * until finding a directory that contains both a 'packages/' subdirectory and a root 'package.json'
 */
export const resolveRepoRoot = (startDir: string): string => {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    const packagesDir = path.join(current, 'packages');
    const packageJson = path.join(current, 'package.json');
    if (fs.existsSync(packagesDir) && fs.existsSync(packageJson)) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error(`Could not find repo root starting from ${startDir}`);
};
