#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join } from 'node:path';

// Copy typings
try {
  execSync('node scripts/copyTypings.mts', { stdio: 'inherit' });
} catch {
  console.error('Error:node scripts/copyTypings.mts couldnt be executed');
  process.exit(1);
}

//Copy src/resources into out/src/
cpSync('src/resources', join('out', 'src', 'resources'), { recursive: true });
