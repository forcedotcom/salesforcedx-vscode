#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { logger } from './loggerUtil.mts';

// Publishes the .vsix that matches the version in package.json

const packageJson: unknown = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (
  typeof packageJson !== 'object' ||
  packageJson === null ||
  !('version' in packageJson) ||
  typeof packageJson.version !== 'string'
) {
  logger.error('No version found in package.json');
  process.exit(1);
}
const packageVersion = packageJson.version;
const vsix = fs.readdirSync('.').filter(file => file.match(`-${packageVersion}.vsix`));

if (vsix.length === 0) {
  logger.error('No VSIX found matching the requested version in package.json');
  process.exit(1);
}

const VSCE_PERSONAL_ACCESS_TOKEN = process.env['VSCE_PERSONAL_ACCESS_TOKEN'];
try {
  execSync(
    `vsce publish ${VSCE_PERSONAL_ACCESS_TOKEN ? `--pat ${VSCE_PERSONAL_ACCESS_TOKEN}` : ''} --packagePath ${vsix.join(',')}`,
    { stdio: 'inherit' }
  );
} catch {
  logger.error(`There was an error while publishing extension ${vsix.join(',')}`);
  process.exit(1);
}
