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

const DREAMHOUSE_REPO = 'https://github.com/trailheadapps/dreamhouse-lwc';
export const DREAMHOUSE_ORG_ALIAS = 'orgBrowserDreamhouseTestOrg';
/** Create Dreamhouse scratch org - if running locally, could create many orgs in parallel. Better to run steps once, or run just one test */
export const create = async (): Promise<OrgAuthResult> => {
  // Fast path: use provided org and skip org creation/deploy (requires deploy, permset already done)
  const existingOrg = await tryUseExistingOrg(DREAMHOUSE_ORG_ALIAS);
  if (existingOrg) {
    return existingOrg;
  }

  requireOrgInCI(DREAMHOUSE_ORG_ALIAS);

  // Full flow: clone, create, deploy
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dh-lwc-'));
  const repoDir = path.join(tmpRoot, 'dreamhouse-lwc');

  await execAsync(`git clone --depth=1 ${DREAMHOUSE_REPO} ${repoDir}`);

  const { stdout: createStdout } = await execAsync(
    `sf org create scratch -d -f config/project-scratch-def.json -a ${DREAMHOUSE_ORG_ALIAS} --json`,
    { cwd: repoDir, env }
  );

  const authFields = extractAuthFields(createStdout);

  await execAsync('sf project deploy start', { cwd: repoDir });
  await execAsync('sf org assign permset -n dreamhouse -o dreamhouse', { cwd: repoDir });

  return authFields;
};
