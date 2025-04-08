/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
export const ensureCurrentWorkingDirIsProjectPath = (rootWorkspacePath: string): void => {
  if (rootWorkspacePath && process.cwd() !== rootWorkspacePath && fs.existsSync(rootWorkspacePath)) {
    process.chdir(rootWorkspacePath);
  }
};
