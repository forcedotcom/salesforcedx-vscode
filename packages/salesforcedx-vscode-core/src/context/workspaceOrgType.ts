import { AuthInfo } from '@salesforce/core';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  ForceConfigGet,
  ForceOrgList
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export async function setupWorkspaceOrgType(isActivation?: boolean) {
  const defaultUsername = await getDefaultUsername();
  const defaultUsernameIsSet = typeof defaultUsername !== 'undefined';

  if (isActivation) {
    setDefaultOrgIsScratchOrg(defaultUsernameIsSet);
    setDefaultOrgIsNonScratchOrg(defaultUsernameIsSet);
  } else {
    let isScratchOrg = false;
    if (defaultUsernameIsSet) {
      const authInfo = await AuthInfo.create(defaultUsername);
      console.log(authInfo);
      const forceOrgList = new ForceOrgList();
      isScratchOrg = await forceOrgList.isScratchOrg(defaultUsername!);
    }
    setDefaultOrgIsScratchOrg(defaultUsernameIsSet && isScratchOrg);
    setDefaultOrgIsNonScratchOrg(defaultUsernameIsSet && !isScratchOrg);
  }
}

function setDefaultOrgIsScratchOrg(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_org_is_scratch_org',
    val
  );
}

function setDefaultOrgIsNonScratchOrg(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_org_is_non_scratch_org',
    val
  );
}

async function getDefaultUsername(): Promise<string | undefined> {
  if (
    vscode.workspace.workspaceFolders instanceof Array &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const forceConfig = await new ForceConfigGet().getConfig(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      'defaultusername'
    );
    return forceConfig.get('defaultusername');
  }
}

export function registerDefaultOrgWatcher(context: vscode.ExtensionContext) {
  if (
    vscode.workspace.workspaceFolders instanceof Array &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const sfdxConfigWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.workspace.workspaceFolders[0],
        path.join('.sfdx', 'sfdx-config.json')
      )
    );
    sfdxConfigWatcher.onDidChange(uri => setupWorkspaceOrgType());
    sfdxConfigWatcher.onDidCreate(uri => setupWorkspaceOrgType());
    sfdxConfigWatcher.onDidDelete(uri => setupWorkspaceOrgType());
    context.subscriptions.push(sfdxConfigWatcher);
  }
}
