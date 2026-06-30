/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgAuthResult, OrgDisplayResult } from './types';
import type { AuthFields } from '@salesforce/core';
import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

export const execAsync = promisify(exec);
export const env = { ...process.env, NO_COLOR: '1' };

/**
 * Run `sf org create scratch` and return its stdout. On failure, persist the raw CLI stdout/stderr
 * (the `--json` error body) to `~/.sf/vscode-spans/org-create-failure-<timestamp>.txt` — CI copies
 * that dir into test-results (orgE2E.yml) — and rethrow an error that includes the body. Without
 * this, `execAsync` throws a bare `Command failed: …` and the actual scratch-org error (limit hit,
 * dev-hub auth, timeout) is lost, making every CI org-create failure a black box.
 */
export const runScratchOrgCreate = async (command: string, cwd: string): Promise<string> => {
  try {
    const { stdout } = await execAsync(command, { cwd, env });
    return stdout;
  } catch (err) {
    const { stdout = '', stderr = '' } = err as { stdout?: string; stderr?: string };
    const body = `command: ${command}\n\n--- stdout ---\n${stdout}\n\n--- stderr ---\n${stderr}`;
    const dir = path.join(os.homedir(), '.sf', 'vscode-spans');
    const file = path.join(dir, `org-create-failure-${Date.now()}.txt`);
    await fs.mkdir(dir, { recursive: true }).catch(() => undefined);
    await fs.writeFile(file, body).catch(() => undefined);
    throw new Error(`Scratch org creation failed (${command}). CLI output:\n${body}`);
  }
};

/** Try to use existing org, return auth fields if found */
export const tryUseExistingOrg = async (orgAlias: string): Promise<OrgAuthResult | undefined> => {
  try {
    const displayResponse = JSON.parse(
      (await execAsync(`sf org display -o ${orgAlias} --json`, { env })).stdout
    ) as OrgDisplayResult;

    const tokenResponse = JSON.parse(
      (await execAsync(`sf org auth show-access-token -o ${orgAlias} --json`, { env })).stdout
    ) as { result: { accessToken: string } };

    return {
      accessToken: tokenResponse.result.accessToken,
      instanceUrl: displayResponse.result.instanceUrl,
      instanceApiVersion: displayResponse.result.apiVersion
    };
  } catch {
    return undefined;
  }
};

/** Validate and return auth fields from scratch org creation response */
export const extractAuthFields = async (createStdout: string, orgAlias: string): Promise<OrgAuthResult> => {
  const createResponse = JSON.parse(createStdout) as { result: { authFields: AuthFields } };
  const authFields = createResponse?.result?.authFields;

  if (!authFields.instanceUrl || !authFields.instanceApiVersion) {
    throw new Error(
      'Scratch org creation did not return required credentials (authFields.instanceUrl, authFields.instanceApiVersion).'
    );
  }

  const tokenResponse = JSON.parse(
    (await execAsync(`sf org auth show-access-token -o ${orgAlias} --json`, { env })).stdout
  ) as { result: { accessToken: string } };

  return {
    accessToken: tokenResponse.result.accessToken,
    instanceUrl: authFields.instanceUrl,
    instanceApiVersion: authFields.instanceApiVersion
  };
};

/** Check if running in CI, throw error if org not found */
export const requireOrgInCI = (orgAlias: string): void => {
  if (process.env.CI) {
    throw new Error(`Scratch org with alias ${orgAlias} not found.`);
  }
  console.warn(`Scratch org with alias ${orgAlias} not found. Will create a new one.`);
};
