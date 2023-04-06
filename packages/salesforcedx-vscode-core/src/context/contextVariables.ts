/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { OrgAuthInfo } from '../util';

export async function setIsScratchOrg() {
  const username = await ConfigUtil.getUsername();
  if (!username) {
    return;
  }
  const isScratchOrg = await OrgAuthInfo.isAScratchOrg(username);
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:is_scratch_org',
    isScratchOrg
  );
}
