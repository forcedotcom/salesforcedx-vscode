/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgAuthResult, OrgDisplayResult } from './types';
import * as Schema from 'effect/Schema';
import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

export const execAsync = promisify(exec);
export const env = { ...process.env, NO_COLOR: '1' };
const ShowAccessTokenResponse = Schema.Struct({
  result: Schema.Struct({ accessToken: Schema.optional(Schema.String) }).pipe(Schema.NullOr, Schema.optional)
});

/**
 * Run `sf org create scratch`. On failure, persist the raw CLI stdout/stderr
 * (the `--json` error body) to `~/.sf/vscode-spans/org-create-failure-<timestamp>.txt` — CI copies
 * that dir into test-results (orgE2E.yml) — and rethrow an error that includes the body. Without
 * this, `execAsync` throws a bare `Command failed: …` and the actual scratch-org error (limit hit,
 * dev-hub auth, timeout) is lost, making every CI org-create failure a black box.
 */
export const runScratchOrgCreate = async (command: string, cwd: string): Promise<void> => {
  try {
    await execAsync(command, { cwd, env });
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

/** Read metadata from org display and the credential from the dedicated auth command. */
export const getOrgAuthFields = async (orgAlias: string): Promise<OrgAuthResult> => {
  const displayResponse = JSON.parse(
    (await execAsync(`sf org display -o ${orgAlias} --json`, { env })).stdout
  ) as OrgDisplayResult;
  const tokenResponse = Schema.decodeUnknownSync(ShowAccessTokenResponse)(
    JSON.parse((await execAsync(`sf org auth show-access-token -o ${orgAlias} --json`, { env })).stdout)
  );

  if (!displayResponse.result.instanceUrl || !displayResponse.result.apiVersion || !tokenResponse.result?.accessToken) {
    throw new Error(`Org ${orgAlias} did not return an instance URL, API version, and access token.`);
  }

  return {
    accessToken: tokenResponse.result.accessToken,
    instanceUrl: displayResponse.result.instanceUrl,
    instanceApiVersion: displayResponse.result.apiVersion
  };
};

/*
 * Is the org described by `sf org display --json` actually alive and reusable? A cached scratch org
 * can be Deleted/expired while `sf org auth show-access-token` still hands back a STALE cached token —
 * reuse it and the CB container boot fails to log in ("Unable to automatically login to org during
 * start"), surfacing downstream as a confusing `NoTargetOrgConfiguredError`. So we reuse an alias only
 * when `org display` shows no positive evidence of death: a live connection, a non-Deleted status, and
 * (for scratch orgs) an expiration still in the future. Missing fields are treated as "no evidence of
 * death" so a non-scratch/older-CLI happy path isn't broken by an over-eager check.
 */
const isOrgAlive = (result: OrgDisplayResult['result']): boolean => {
  // Case-insensitive: guard against CLI casing variants ('Deleted' / 'DELETED' / 'deleted').
  if (result.status?.toLowerCase() === 'deleted') {
    return false;
  }
  if (result.connectedStatus !== undefined && result.connectedStatus !== 'Connected') {
    return false;
  }
  if (result.expirationDate !== undefined) {
    const expiresAt = Date.parse(result.expirationDate);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return false;
    }
  }
  return true;
};

/** Try to use existing org, return auth fields if found AND the org is actually alive (not dead/expired) */
export const tryUseExistingOrg = async (orgAlias: string): Promise<OrgAuthResult | undefined> => {
  try {
    // Liveness gate BEFORE reading the token: `show-access-token` returns a stale cached token even
    // for a Deleted/expired org, so trusting it would hand back a dead org. Fall through to create.
    const displayResponse = JSON.parse(
      (await execAsync(`sf org display -o ${orgAlias} --json`, { env })).stdout
    ) as OrgDisplayResult;
    if (!isOrgAlive(displayResponse.result)) {
      return undefined;
    }

    return await getOrgAuthFields(orgAlias);
  } catch {
    return undefined;
  }
};

/** Check if running in CI, throw error if org not found */
export const requireOrgInCI = (orgAlias: string): void => {
  if (process.env.CI) {
    throw new Error(`Scratch org with alias ${orgAlias} not found.`);
  }
  console.warn(`Scratch org with alias ${orgAlias} not found. Will create a new one.`);
};
