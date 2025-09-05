/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';

/**
 * Extracts the module/component name from a directory path
 */
export function moduleFromDirectory(dirPath: string, isSFDX: boolean): string | undefined {
  if (isSFDX) {
    // For SFDX projects, the component name is the directory name
    return path.basename(dirPath);
  }
  // For non-SFDX projects, the logic would be different
  return path.basename(dirPath);
}

/**
 * Extracts the module/component name from a file path
 */
export function moduleFromFile(filePath: string, isSFDX: boolean): string | undefined {
  if (isSFDX) {
    // For SFDX projects, the component name is the parent directory name
    return path.basename(path.dirname(filePath));
  }
  // For non-SFDX projects, the logic would be different
  return path.basename(path.dirname(filePath));
}
