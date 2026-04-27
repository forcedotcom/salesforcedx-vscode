/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';

const SFDX_PROJECT = 'sfdx-project.json';

export type WorkspaceType =
  | 'STANDARD'
  | 'STANDARD_LWC'
  | 'MONOREPO'
  | 'MONOREPO_LWC'
  | 'SFDX'
  | 'CORE_ALL'
  | 'CORE_PARTIAL'
  | 'UNKNOWN';

export const isLWC = (type: WorkspaceType): boolean =>
  type === 'SFDX' || type === 'STANDARD_LWC' || type === 'CORE_ALL' || type === 'CORE_PARTIAL';

export const getSfdxProjectFile = (root: string): string => path.join(root, SFDX_PROJECT);
