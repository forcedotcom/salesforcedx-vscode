/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContext } from './workspaceContext';
import {
  getDefaultUsernameOrAlias,
  getWorkspaceOrgType,
  OrgType,
  setupWorkspaceOrgType,
  setWorkspaceOrgTypeWithOrgType
} from './workspaceOrgType';

export const workspaceContext = WorkspaceContext.getInstance();
export const workspaceContextUtils = {
  setWorkspaceOrgTypeWithOrgType,
  getDefaultUsernameOrAlias,
  getWorkspaceOrgType,
  OrgType,
  setupWorkspaceOrgType
};
export { OrgType } from './workspaceOrgType';
