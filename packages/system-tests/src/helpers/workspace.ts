/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import * as path from 'path';
import * as fs from 'fs';
import { tmpdir } from 'os';

export function createWorkspace(assetToSeedPath: string): string {
  const prefix = (Date.now() + Math.round(Math.random() * 1000)).toString();
  const workspacePath = path.join(tmpdir(), prefix);
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.cpSync(assetToSeedPath, workspacePath, { recursive: true });
  return path.join(workspacePath);
}

export function removeWorkspace(pathToRemove: string) {
  fs.rmSync(pathToRemove, { recursive: true, force: true });
}
