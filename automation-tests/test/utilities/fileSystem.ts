/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ChildProcess,
  exec
} from 'child_process';

export function createFolder(folderPath: string): ChildProcess {
  const childProcess = exec(`mkdir "${folderPath}"`);

  return childProcess;
}

export function removeFolder(folderPath: string): ChildProcess {
  const childProcess = exec(`rm -rf "${folderPath}"`);

  return childProcess;
}
