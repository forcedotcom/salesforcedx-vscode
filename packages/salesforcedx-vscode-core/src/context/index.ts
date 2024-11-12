/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getOrgShape } from './workspaceOrgShape';
import {
  getTargetOrgOrAlias,
  getWorkspaceOrgType,
  OrgType,
  setupWorkspaceOrgType,
  setWorkspaceOrgTypeWithOrgType
} from './workspaceOrgType';

export { WorkspaceContext } from './workspaceContext';
export const workspaceContextUtils = {
  setWorkspaceOrgTypeWithOrgType,
  getTargetOrgOrAlias,
  getWorkspaceOrgType,
  OrgType,
  setupWorkspaceOrgType,
  getOrgShape
};
export { OrgType } from './workspaceOrgType';
