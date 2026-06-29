/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgAuthResult } from './types';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execAsync, env, tryUseExistingOrg, extractAuthFields } from './shared';

/**
 * Dedicated throwaway org for the real-logout e2e step. FIXED alias (not timestamped/uuid) so CI's
 * pre-seed step (orgE2E.yml) can hit the `tryUseExistingOrg` fast path.
 */
export const THROWAWAY_ORG_ALIAS = 'logoutThrowawayOrg';

/**
 * Create a throwaway scratch org for the logout test. Unlike {@link createMinimalOrg}, this org is
 * CONSUMED by the test (real logout removes its auth), so a miss must re-create it even in CI:
 * Playwright retries + the sequential `--last-failed` retry step both re-run setup after attempt 1
 * has already logged the org out. No `requireOrgInCI` gate — a miss recreates via `sf org create
 * scratch` (CI has dev-hub auth). The CI pre-seed only saves the first attempt a create.
 */
export const createThrowawayOrg = async (alias: string = THROWAWAY_ORG_ALIAS): Promise<OrgAuthResult> => {
  // Fast path: use provided org if it exists
  const existingOrg = await tryUseExistingOrg(alias);
  if (existingOrg) {
    return existingOrg;
  }

  // Create minimal scratch org without any deployment
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'logout-throwaway-org-'));
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
    `sf org create scratch -d -w 10 -a ${alias} --edition developer --json`,
    {
      cwd: projectDir,
      env
    }
  );

  return extractAuthFields(createStdout, alias);
};
