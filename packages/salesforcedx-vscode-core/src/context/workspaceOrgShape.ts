/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgAuthInfo, workspaceUtils } from '../util';
export enum OrgShape {
  Scratch = 'Scratch',
  Sandbox = 'Sandbox',
  Production = 'Production',
  Undefined = 'Undefined'
};

export const getOrgShape = async (username: string): Promise<OrgShape> => {
  if (workspaceUtils.hasRootWorkspace()) {
    if (await OrgAuthInfo.isASandboxOrg(username)) {
      return OrgShape.Sandbox;
    } else if (await OrgAuthInfo.isAScratchOrg(username)) {
      return OrgShape.Scratch;
    } else if (await OrgAuthInfo.getTargetOrgOrAlias(false) !== undefined) {
      return OrgShape.Production;
    } else {
      return OrgShape.Undefined;
    }
  } else {
    return OrgShape.Undefined;
  }
};
