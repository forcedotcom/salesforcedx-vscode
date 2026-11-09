#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const vsixfilesLocation = path.join(cwd, 'extensions');
const vsixes = fs.readdirSync(vsixfilesLocation);

if (vsixes.length === 0) {
  console.error('No VSIX files found matching the requested version in package.json');
  process.exit(1);
}

process.chdir(vsixfilesLocation);
for (const vsix of vsixes) {
  try {
    execSync(process.platform === 'win32' ? `CertUtil -hashfile ${vsix} SHA256` : `shasum -a 256 ${vsix}`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error(`Error generating SHA256 for ${vsix}:`, error);
    process.exit(1);
  }
}
