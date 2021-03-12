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

export function getTestResultsFolder(rootDirPath: string, testType: string) {
  const dirPath = path.join(
    rootDirPath,
    '.sfdx',
    'tools',
    'testresults',
    testType
  );

  ensureDirectoryExists(dirPath);
  return dirPath;
}

export function getLogDirPath(rootDirPath: string): string {
  const dirPath = path.join(rootDirPath, '.sfdx', 'tools', 'debug', 'logs');
  ensureDirectoryExists(dirPath);
  return dirPath;
}
