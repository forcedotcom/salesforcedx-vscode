import * as path from 'path';
import * as vscode from 'vscode';

import {
  ForceConfigGet,
  ForceOrgList
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export function setDefaultOrgTypeIsKnown(isKnown: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_org_type_is_known',
    isKnown
  );
}

export async function setDefaultUsernameIsSet() {
  const defaultUsername = await getDefaultUsername();
  const defaultUsernameIsSet = typeof defaultUsername !== 'undefined';
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_username_is_set',
    defaultUsernameIsSet
  );
}

export async function setupWorkspaceOrgType() {
  setTimeout(async () => {
    const defaultUsername = await getDefaultUsername();
    const defaultUsernameIsSet = typeof defaultUsername !== 'undefined';
    vscode.commands.executeCommand(
      'setContext',
      'sfdx:default_username_is_set',
      defaultUsernameIsSet
    );

    let isScratchOrg = false;
    if (defaultUsernameIsSet) {
      const forceOrgList = new ForceOrgList();
      isScratchOrg = await forceOrgList.isScratchOrg(defaultUsername!);
    }
    vscode.commands.executeCommand(
      'setContext',
      'sfdx:default_org_is_scratch_org',
      defaultUsernameIsSet && isScratchOrg
    );
    vscode.commands.executeCommand(
      'setContext',
      'sfdx:default_org_is_non_scratch_org',
      defaultUsernameIsSet && !isScratchOrg
    );
    setDefaultOrgTypeIsKnown(true);
  }, 120000);
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
