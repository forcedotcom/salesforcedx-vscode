/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgShape } from '../../context/workspaceOrgShape';

/** Org identity fields carried on the services identity bridge. */
export type OrgIdentity = {
  orgId?: string;
  orgShape?: OrgShape;
  devHubId?: string;
  orgEdition?: string;
};
