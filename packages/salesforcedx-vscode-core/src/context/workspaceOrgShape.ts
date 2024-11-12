/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgShape } from '@salesforce/salesforcedx-utils-vscode';
import { OrgAuthInfo, workspaceUtils } from '../util';

export const getOrgShape = async (username: string): Promise<OrgShape> => {
  if (workspaceUtils.hasRootWorkspace()) {
    if (await OrgAuthInfo.isAScratchOrg(username)) {
      return 'Scratch';
    } else if (await OrgAuthInfo.isASandboxOrg(username)) {
      return 'Sandbox';
    } else if ((await OrgAuthInfo.getTargetOrgOrAlias(false)) !== undefined) {
      return 'Production';
    } else {
      return 'Undefined';
    }
  } else {
    return 'Undefined';
  }
};
