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

export const NON_TRACKING_ORG_ALIAS = 'nonTrackingTestOrg';

/** Create minimal scratch org without source tracking for e2e tests */
export const createNonTrackingOrg = async (): Promise<OrgAuthResult> => {
  // Fast path: use provided org if it exists
  const existingOrg = await tryUseExistingOrg(NON_TRACKING_ORG_ALIAS);
  if (existingOrg) {
    return existingOrg;
  }

  requireOrgInCI(NON_TRACKING_ORG_ALIAS);

  // Create minimal scratch org without any deployment
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'non-tracking-org-'));
  const projectDir = path.join(tmpRoot, 'non-tracking-project');

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

  const { stdout: createStdout } = await execAsync(
    `sf org create scratch -d -w 10 -a ${NON_TRACKING_ORG_ALIAS} --wait 30 --no-track-source --json`,
    {
      cwd: projectDir,
      env
    }
  );

  return extractAuthFields(createStdout);
};
