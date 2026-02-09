/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  getDevHubUsername,
  getTargetDevHubOrAlias,
  getUsername,
  isAScratchOrg,
  isASandboxOrg,
  getDevHubIdFromScratchOrg,
  getConnection,
  getAuthFields
} from '@salesforce/salesforcedx-utils-vscode';
// getTargetOrgOrAlias deprecated - use TargetOrgRef from services extension instead
export { checkForSoonToBeExpiredOrgs, setTargetOrgOrAlias, updateConfigAndStateAggregators } from './orgUtil';
export { getOrgInfo } from './orgDisplay';
export { getConnectionStatusFromError, shouldRemoveOrg } from './orgUtil';
