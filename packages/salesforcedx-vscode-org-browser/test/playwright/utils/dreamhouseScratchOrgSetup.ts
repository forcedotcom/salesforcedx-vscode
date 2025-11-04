/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is Node.js test infrastructure, not extension code
import type { AuthFields } from '@salesforce/core';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const DREAMHOUSE_REPO = 'https://github.com/trailheadapps/dreamhouse-lwc';
export const DREAMHOUSE_ORG_ALIAS = 'orgBrowserDreamhouseTestOrg';

const execAsync = promisify(exec);

const env = { ...process.env, NO_COLOR: '1' };
/** this, if running all your tests locally, could create a lot of scratch orgs in parallel.  It's definitely better to run the steps once, or run just one test to get things going */
export const create = async (): Promise<
  Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>>
> => {
  // Fast path for local iteration: use provided org and skip org creation/deploy
  // requires that you already did the deploy, permset, etc on the org.
  try {
    const displayResponse = JSON.parse(
      (await execAsync(`sf org display -o ${DREAMHOUSE_ORG_ALIAS} --json`, { env })).stdout
    ).result as { accessToken: string; instanceUrl: string; apiVersion: string }; // TODO: can we get these type definitions from the org plugin?

    return {
      accessToken: displayResponse.accessToken,
      instanceUrl: displayResponse.instanceUrl,
      instanceApiVersion: displayResponse.apiVersion
    };
  } catch {
    if (process.env.CI) {
      throw new Error(`Dreamhouse scratch org with alias ${DREAMHOUSE_ORG_ALIAS} not found.`);
    }
    console.warn(`Dreamhouse scratch org with alias ${DREAMHOUSE_ORG_ALIAS} not found.  Will create a new one.`);
  }

  // Full flow: clone, create, deploy
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dh-lwc-'));
  const repoDir = path.join(tmpRoot, 'dreamhouse-lwc');

  await execAsync(`git clone --depth=1 ${DREAMHOUSE_REPO} ${repoDir}`);

  const { stdout: createStdout } = await execAsync(
    `sf org create scratch -d -f config/project-scratch-def.json -a ${DREAMHOUSE_ORG_ALIAS} --json`,
    { cwd: repoDir, env }
  );

  const createResponse = JSON.parse(createStdout);
  const authFields = createResponse?.result?.authFields ?? {};
  if (!authFields.instanceUrl || !authFields.accessToken || !authFields.instanceApiVersion) {
    throw new Error(
      'Scratch org creation did not return required credentials (authFields.instanceUrl, authFields.accessToken, authFields.instanceApiVersion).'
    );
  }

  await execAsync('sf project deploy start', { cwd: repoDir });
  await execAsync('sf org assign permset -n dreamhouse -o dreamhouse', { cwd: repoDir });
  return {
    accessToken: authFields.accessToken,
    instanceUrl: authFields.instanceUrl,
    instanceApiVersion: authFields.instanceApiVersion
  };
};
