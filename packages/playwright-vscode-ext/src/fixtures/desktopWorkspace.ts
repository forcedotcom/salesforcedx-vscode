/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

/** Salesforce CLI state folder name. Mirrors `Global.SF_STATE_FOLDER` from `@salesforce/core` without taking it as a runtime dep. */
const SF_STATE_FOLDER = '.sf';

/** Create a temporary empty workspace directory (no sfdx-project.json) for desktop tests */
export const createEmptyTestWorkspace = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), 'vscode-e2e-empty-'));

/**
 * Create a temporary workspace directory with sfdx-project.json for desktop tests.
 * @param orgAlias If set, writes `.sfdx/config.json` with `target-org`. If omitted or `undefined`, no `config.json` (no default org).
 */
export const createTestWorkspace = async (orgAlias?: string): Promise<string> => {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-e2e-test-'));

  await Promise.all([
    // Create sfdx-project.json
    fs.writeFile(
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
    ),
    fs.mkdir(path.join(workspaceDir, 'force-app', 'main', 'default'), { recursive: true }),
    fs.mkdir(path.join(workspaceDir, SF_STATE_FOLDER), { recursive: true }),
    // Minimal scratch-def so `sf.org.create`'s FileSelector (glob `config/**/*-scratch-def.json`) finds a match.
    fs
      .mkdir(path.join(workspaceDir, 'config'), { recursive: true })
      .then(() =>
        fs.writeFile(
          path.join(workspaceDir, 'config', 'project-scratch-def.json'),
          JSON.stringify({ orgName: 'vscode e2e', edition: 'Developer' }, null, 2)
        )
      )
  ]);

  if (orgAlias !== undefined) {
    await fs.writeFile(
      path.join(workspaceDir, SF_STATE_FOLDER, 'config.json'),
      JSON.stringify(
        {
          'target-org': orgAlias
        },
        null,
        2
      )
    );
  }

  return workspaceDir;
};
