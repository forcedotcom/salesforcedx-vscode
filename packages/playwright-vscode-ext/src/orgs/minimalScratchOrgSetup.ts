/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgAuthResult } from './types';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execAsync, env, tryUseExistingOrg, extractAuthFields, requireOrgInCI } from './shared';

export const MINIMAL_ORG_ALIAS = 'minimalTestOrg';

/** Create minimal scratch org without Dreamhouse for services e2e tests */
export const createMinimalOrg = async (): Promise<OrgAuthResult> => {
  // Fast path: use provided org if it exists
  const existingOrg = await tryUseExistingOrg(MINIMAL_ORG_ALIAS);
  if (existingOrg) {
    return existingOrg;
  }

  requireOrgInCI(MINIMAL_ORG_ALIAS);

  // Create minimal scratch org without any deployment
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'minimal-org-'));
  const projectDir = path.join(tmpRoot, 'minimal-project');

  // Create minimal sfdx project structure
  await fs.mkdir(projectDir);
  await fs.writeFile(
    path.join(projectDir, 'sfdx-project.json'),
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

  const { stdout: createStdout } = await execAsync(`sf org create scratch -d -w 10 -a ${MINIMAL_ORG_ALIAS} --json`, {
    cwd: projectDir,
    env
  });

  return extractAuthFields(createStdout);
};
