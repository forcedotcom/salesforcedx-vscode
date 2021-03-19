/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';

export function ensureDirectoryExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }
  ensureDirectoryExists(path.dirname(filePath));
  fs.mkdirSync(filePath);
}

export function getTestResultsFolder(vscodePath: string, testType: string) {
  const dirPath = path.join(
    vscodePath,
    '.sfdx',
    'tools',
    'testresults',
    testType
  );

  ensureDirectoryExists(dirPath);
  return dirPath;
}
