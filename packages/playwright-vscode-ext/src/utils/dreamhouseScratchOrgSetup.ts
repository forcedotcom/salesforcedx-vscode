/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { AuthFields } from '@salesforce/core';
import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

const DREAMHOUSE_REPO = 'https://github.com/trailheadapps/dreamhouse-lwc';
export const DREAMHOUSE_ORG_ALIAS = 'orgBrowserDreamhouseTestOrg';

const execAsync = promisify(exec);

type SfOrgDisplayResultBody = {
  accessToken: string;
  instanceUrl: string;
  apiVersion: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const isSfOrgDisplayJson = (v: unknown): v is { result: SfOrgDisplayResultBody } => {
  if (!isRecord(v) || !('result' in v)) return false;
  const r = v.result;
  if (!isRecord(r)) return false;
  return typeof r.accessToken === 'string' && typeof r.instanceUrl === 'string' && typeof r.apiVersion === 'string';
};

type SfScratchCreateAuthFields = {
  instanceUrl?: string;
  accessToken?: string;
  instanceApiVersion?: string;
};

const isSfScratchCreateJson = (v: unknown): v is { result?: { authFields?: SfScratchCreateAuthFields } } =>
  isRecord(v) && (!('result' in v) || v.result === undefined || isRecord(v.result));

const env = { ...process.env, NO_COLOR: '1' };
/** this, if running all your tests locally, could create a lot of scratch orgs in parallel.  It's definitely better to run the steps once, or run just one test to get things going */
export const create = async (): Promise<
  Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>>
> => {
  // Fast path for local iteration: use provided org and skip org creation/deploy
  // requires that you already did the deploy, permset, etc on the org.
  try {
    const stdout = (await execAsync(`sf org display -o ${DREAMHOUSE_ORG_ALIAS} --json`, { env })).stdout;
    const displayResponse: unknown = JSON.parse(stdout);
    if (!isSfOrgDisplayJson(displayResponse)) {
      throw new Error('sf org display returned unexpected JSON shape');
    }
    const { result } = displayResponse;

    return {
      accessToken: result.accessToken,
      instanceUrl: result.instanceUrl,
      instanceApiVersion: result.apiVersion
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
    `sf org create scratch -d -f config/project-scratch-def.json -a ${DREAMHOUSE_ORG_ALIAS} --json --wait 30`,
    { cwd: repoDir, env }
  );

  const createResponse: unknown = JSON.parse(createStdout);
  if (!isSfScratchCreateJson(createResponse)) {
    throw new Error('sf org create scratch returned unexpected JSON shape');
  }
  const authFields = createResponse.result?.authFields ?? {};

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
