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
  // CI: workflow injects credentials directly via $GITHUB_ENV after 'sf org create scratch'.
  // Avoids calling 'sf org display' in the worker process, which can fail because sf is
  // installed globally mid-job (after try-run) and may not be on PATH at module-load time.
  if (process.env.SCRATCH_ORG_ACCESS_TOKEN && process.env.SCRATCH_ORG_INSTANCE_URL) {
    return {
      accessToken: process.env.SCRATCH_ORG_ACCESS_TOKEN,
      instanceUrl: process.env.SCRATCH_ORG_INSTANCE_URL,
      instanceApiVersion: process.env.SCRATCH_ORG_API_VERSION ?? '62.0'
    };
  }

  // Local dev: reuse an existing scratch org to avoid slow creation and scratch org limit usage
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

  const { stdout: createStdout } = await execAsync(
    `sf org create scratch -d -a ${MINIMAL_ORG_ALIAS} --edition developer --wait 30 --json`,
    {
      cwd: projectDir,
      env
    }
  );

  return extractAuthFields(createStdout);
};
