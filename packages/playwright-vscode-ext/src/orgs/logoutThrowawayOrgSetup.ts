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
import { execAsync, env, tryUseExistingOrg, extractAuthFields, requireOrgInCI } from './shared';

/**
 * Dedicated throwaway org for the real-logout e2e step. FIXED (not timestamped/uuid) because a
 * non-pre-seeded alias trips `requireOrgInCI` before any create code runs. CI pre-seeds this alias
 * (orgE2E.yml) so `tryUseExistingOrg` hits and the gate is never reached; the org being logged out
 * by the test is fine since it is single-purpose and re-seeded each run.
 */
export const THROWAWAY_ORG_ALIAS = 'logoutThrowawayOrg';

/**
 * Create a throwaway scratch org for the logout test. Mirrors {@link createMinimalOrg}:
 * tryUseExistingOrg fast path, then requireOrgInCI on a miss, then `sf org create scratch`.
 * Locally (non-CI) a miss re-creates the org; CI relies on the pre-seeded alias.
 */
export const createThrowawayOrg = async (alias: string = THROWAWAY_ORG_ALIAS): Promise<OrgAuthResult> => {
  // Fast path: use provided org if it exists
  const existingOrg = await tryUseExistingOrg(alias);
  if (existingOrg) {
    return existingOrg;
  }

  requireOrgInCI(alias);

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
