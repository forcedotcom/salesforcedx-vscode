/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { AuthFields } from '@salesforce/core';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const DREAMHOUSE_REPO = 'https://github.com/trailheadapps/dreamhouse-lwc';
const execAsync = promisify(exec);

// TODO: allow any repo from github
export const create = async (): Promise<
  Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>> & {
    tmpRoot?: string;
    repoDir?: string;
    createdScratch?: boolean;
  }
> => {
  // Fast path for local iteration: use provided envs and skip org creation/deploy
  const envToken = process.env.E2E_ORG_ACCESS_TOKEN;
  const envInstance = process.env.E2E_ORG_INSTANCE_URL;
  const envApi = process.env.E2E_ORG_API_VERSION;
  if (envToken && envInstance) {
    return {
      accessToken: envToken,
      instanceUrl: envInstance,
      instanceApiVersion: envApi ?? '64.0'
    } satisfies AuthFields & Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>>;
  }

  // Full flow: clone, create, deploy
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dh-lwc-'));
  const repoDir = path.join(tmpRoot, 'dreamhouse-lwc');

  await execAsync(`git clone --depth=1 ${DREAMHOUSE_REPO} ${repoDir}`);

  const { stdout: createStdout } = await execAsync(
    'sf org create scratch -d -f config/project-scratch-def.json -a dreamhouse --json',
    { cwd: repoDir, env: { ...process.env, NO_COLOR: '1' } }
  );
  const createdScratch = true;

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
    instanceApiVersion: authFields.instanceApiVersion,
    tmpRoot,
    repoDir,
    createdScratch
  };
};
