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

export const NON_TRACKING_ORG_ALIAS = 'nonTrackingTestOrg';
export const HUB_ORG_ALIAS = 'hub';
// Dedicated org for tests that LOG OUT of / delete their default org (apex-testing clear-on-logout).
// Separate alias so destroying it never breaks the shared nonTrackingTestOrg other specs depend on.
export const LOGOUT_TEST_ORG_ALIAS = 'apexTestingLogoutOrg';

// Minimal sfdx project so `sf org create scratch` has a project context. Returned dir is caller-owned.
const makeScratchProjectDir = async (prefix: string): Promise<string> => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const projectDir = path.join(tmpRoot, 'non-tracking-project');
  // The packageDirectory below points at force-app; sf org create scratch validates it exists.
  await fs.mkdir(path.join(projectDir, 'force-app'), { recursive: true });
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
  return projectDir;
};

/** Create minimal scratch org without source tracking for e2e tests */
export const createNonTrackingOrg = async (alias: string = NON_TRACKING_ORG_ALIAS): Promise<OrgAuthResult> => {
  // Fast path: use provided org if it exists
  const existingOrg = await tryUseExistingOrg(alias);
  if (existingOrg) {
    return existingOrg;
  }

  requireOrgInCI(alias);

  const projectDir = await makeScratchProjectDir('non-tracking-org-');
  const { stdout: createStdout } = await execAsync(
    `sf org create scratch -d -w 10 -a ${alias} --edition developer --no-track-source --json`,
    { cwd: projectDir, env }
  );

  return extractAuthFields(createStdout, alias);
};

/**
 * Non-tracking org under a DEDICATED alias (`LOGOUT_TEST_ORG_ALIAS`) for tests that LOG OUT of / delete
 * their default org (e.g. apex-testing's clear-on-logout). The fixed alias matches the workspace
 * `.sfdx/config.json` `target-org` the desktop fixture writes, so the org is the workspace default and
 * deploy/retrieve commands enable. Reuse-or-create (never `requireOrgInCI`): a prior run logs this org
 * out, so the next run re-creates it under the same alias — keeping the shared `nonTrackingTestOrg` other
 * specs depend on untouched.
 */
export const createLogoutTestOrg = async (alias: string = LOGOUT_TEST_ORG_ALIAS): Promise<OrgAuthResult> => {
  const existingOrg = await tryUseExistingOrg(alias);
  if (existingOrg) {
    return existingOrg;
  }

  const projectDir = await makeScratchProjectDir('logout-test-org-');
  const { stdout: createStdout } = await execAsync(
    `sf org create scratch -d -w 10 -a ${alias} --edition developer --no-track-source --json`,
    { cwd: projectDir, env }
  );

  return extractAuthFields(createStdout, alias);
};
