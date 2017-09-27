/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import * as path from 'path';
import { cp, mkdir, rm, tempdir } from 'shelljs';

export function createWorkspace(assetToSeedPath: string): string {
  const tmpDir = tempdir();
  const prefix = (Date.now() + Math.round(Math.random() * 1000)).toString();
  const workspacePath = path.join(tmpDir, prefix);
  mkdir('-p', workspacePath);
  cp('-R', assetToSeedPath, workspacePath);
  return path.join(workspacePath);
}

export function removeWorkspace(pathToRemove: string) {
  rm('-rf', pathToRemove);
}
