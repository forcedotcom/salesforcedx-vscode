/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  OrgShape,
  workspaceUtils,
  getTargetOrgOrAlias,
  isASandboxOrg,
  isAScratchOrg
} from '@salesforce/salesforcedx-utils-vscode';

export const getOrgShape = async (username: string): Promise<OrgShape> => {
  if (workspaceUtils.hasRootWorkspace()) {
    if (await isAScratchOrg(username)) {
      return 'Scratch';
    } else if (await isASandboxOrg(username)) {
      return 'Sandbox';
    } else if ((await getTargetOrgOrAlias(false)) !== undefined) {
      return 'Production';
    } else {
      return 'Undefined';
    }
  } else {
    return 'Undefined';
  }
};
