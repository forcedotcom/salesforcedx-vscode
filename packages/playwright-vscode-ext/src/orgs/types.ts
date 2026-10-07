/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { AuthFields } from '@salesforce/core';

export type OrgAuthResult = Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>>;

type OrgDisplayFields = {
  instanceUrl: string;
  accessToken: string;
  apiVersion: string;
  // Liveness signals from `sf org display --json`. Optional because non-scratch orgs / older CLIs may
  // omit them; a dead scratch org (Deleted/expired) still returns a stale cached token, so these are
  // what let `tryUseExistingOrg` tell a reusable org from a dead one.
  status?: string;
  connectedStatus?: string;
  expirationDate?: string;
};
export type OrgDisplayResult = { result: OrgDisplayFields };
