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
