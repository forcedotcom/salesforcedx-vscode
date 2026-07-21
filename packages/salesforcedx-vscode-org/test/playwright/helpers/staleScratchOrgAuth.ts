/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * A synthetic, already-expired scratch-org username. Underscore/at keeps it distinct from real orgs.
 * Scoped per worker process (`TEST_WORKER_INDEX` + a random suffix) because it lands in the shared,
 * global `~/.sfdx` auth dir — `createDesktopTest` isolates userDataDir/workspace but NOT `$HOME`, and
 * the desktop config runs `fullyParallel`, so an unscoped fixed username would let one test's stale
 * org be seen by a sibling worker's `listAllAuthorizations` and race its assertions.
 */
const STALE_SCRATCH_ORG_USERNAME = `stale-expired-e2e-${process.env.TEST_WORKER_INDEX ?? '0'}-${Math.random()
  .toString(36)
  .slice(2)}@example.com`;

/**
 * Write a synthetic scratch-org auth file (plaintext, `AuthInfo.create` reads it) into the CLI auth
 * dir (`~/.sfdx`) with an `expirationDate` in the past. `org list clean`'s `classifyOrgForRemoval`
 * then treats it as an expired scratch org and marks it removable — giving the command a non-empty
 * removal set so `displayRemainingOrgs` (and thus `determineConnectedStatusForNonScratchOrg`) runs.
 * Returns the file path so the caller can clean it up.
 */
export const writeStaleScratchOrgAuth = async (): Promise<string> => {
  const authFile = path.join(os.homedir(), '.sfdx', `${STALE_SCRATCH_ORG_USERNAME}.json`);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const auth = {
    orgId: '00Dxx0000000EXPIRED',
    username: STALE_SCRATCH_ORG_USERNAME,
    instanceUrl: 'https://stale-expired-e2e.my.salesforce.com',
    loginUrl: 'https://test.salesforce.com',
    accessToken: '00Dxx0000000EXPIRED!FAKE_TOKEN',
    refreshToken: 'FAKE_REFRESH_TOKEN',
    clientId: 'PlatformCLI',
    isScratch: true,
    isSandbox: false,
    devHubUsername: 'hub',
    expirationDate: yesterday,
    instanceApiVersion: '64.0'
  };
  await fs.writeFile(authFile, JSON.stringify(auth, null, 2));
  return authFile;
};

/** Remove the synthetic auth file written by {@link writeStaleScratchOrgAuth} (no-op if already gone). */
export const removeStaleScratchOrgAuth = async (): Promise<void> => {
  const authFile = path.join(os.homedir(), '.sfdx', `${STALE_SCRATCH_ORG_USERNAME}.json`);
  await fs.rm(authFile, { force: true });
};
