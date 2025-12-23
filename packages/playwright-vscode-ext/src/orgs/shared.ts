/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgAuthResult, OrgDisplayResult } from './types';
import type { AuthFields } from '@salesforce/core';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

export const execAsync = promisify(exec);
export const env = { ...process.env, NO_COLOR: '1' };

/** Try to use existing org, return auth fields if found */
export const tryUseExistingOrg = async (orgAlias: string): Promise<OrgAuthResult | undefined> => {
  try {
    const displayResponse = JSON.parse(
      (await execAsync(`sf org display -o ${orgAlias} --json`, { env })).stdout
    ) as OrgDisplayResult;

    return {
      accessToken: displayResponse.result.accessToken,
      instanceUrl: displayResponse.result.instanceUrl,
      instanceApiVersion: displayResponse.result.apiVersion
    };
  } catch {
    return undefined;
  }
};

/** Validate and return auth fields from scratch org creation response */
export const extractAuthFields = (createStdout: string): OrgAuthResult => {
  const createResponse = JSON.parse(createStdout) as { result: { authFields: AuthFields } };
  const authFields = createResponse?.result?.authFields;

  if (!authFields.instanceUrl || !authFields.accessToken || !authFields.instanceApiVersion) {
    throw new Error(
      'Scratch org creation did not return required credentials (authFields.instanceUrl, authFields.accessToken, authFields.instanceApiVersion).'
    );
  }

  return {
    accessToken: authFields.accessToken,
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
