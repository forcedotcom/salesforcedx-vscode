/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-restricted-imports */
// This is Node.js test infrastructure, not extension code
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { Global } from '@salesforce/core/global';
import { DREAMHOUSE_ORG_ALIAS } from '../utils/dreamhouseScratchOrgSetup';

/** Create a temporary workspace directory with sfdx-project.json for desktop tests */
export const createTestWorkspace = async (): Promise<string> => {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-orgbrowser-test-'));

  // Create sfdx-project.json
  await fs.writeFile(
    path.join(workspaceDir, 'sfdx-project.json'),
    JSON.stringify(
      {
        packageDirectories: [{ path: 'force-app', default: true }],
        namespace: '',
        sfdcLoginUrl: 'https://login.salesforce.com',
        sourceApiVersion: '64.0'
      },
      null,
      2
    )
  );

  // Create .sfdx directory for config
  await fs.mkdir(path.join(workspaceDir, Global.SF_STATE_FOLDER), { recursive: true });

  // Set target org so extension knows which org to use
  // Modern SF CLI uses 'target-org', older sfdx used 'defaultusername'
  await fs.writeFile(
    path.join(workspaceDir, Global.SF_STATE_FOLDER, 'config.json'),
    JSON.stringify(
      {
        'target-org': DREAMHOUSE_ORG_ALIAS
      },
      null,
      2
    )
  );

  await fs.mkdir(path.join(workspaceDir, 'force-app', 'main', 'default'), { recursive: true });

  return workspaceDir;
};
