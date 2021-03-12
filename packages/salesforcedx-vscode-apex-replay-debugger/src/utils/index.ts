/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode/out/src/workspaces';
import * as path from 'path';

export function getLogDirPath(): string {
  return path.join(getRootWorkspacePath(), '.sfdx', 'tools', 'debug', 'logs');
}

export { retrieveTestCodeCoverage } from './settings';
