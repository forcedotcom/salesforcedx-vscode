import { Aliases, AuthInfo } from '@salesforce/core';
import * as path from 'path';
import * as vscode from 'vscode';

import { ForceConfigGet } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export async function setupWorkspaceOrgType() {
  const defaultUsernameOrAlias = await getDefaultUsernameOrAlias();
  const defaultUsernameIsSet = typeof defaultUsernameOrAlias !== 'undefined';
  let isScratchOrg = false;
  if (defaultUsernameIsSet) {
    const username = await getUsername(defaultUsernameOrAlias!);
    try {
      isScratchOrg = await isAScratchOrg(username);
    } catch (e) {
      if (e.name === 'NamedOrgNotFound') {
        // If the info for a default username cannot be found,
        // then assume that the org can be of either type
        console.log('setting defaultUsername inside of enoent catch -- true');
        setDefaultUsernameHasChangeTracking(true);
        setDefaultUsernameHasNoChangeTracking(true);
        return;
      } else {
        throw e;
      }
    }
  }

  console.log(
    `setting defaultUsername to defaultUsernameIsSet: ${defaultUsernameIsSet} && isScratchOrg: ${isScratchOrg}`
  );
  setDefaultUsernameHasChangeTracking(defaultUsernameIsSet && isScratchOrg);
  setDefaultUsernameHasNoChangeTracking(defaultUsernameIsSet && !isScratchOrg);
}

async function isAScratchOrg(username: string): Promise<boolean> {
  const authInfo = await AuthInfo.create(username);
  const authInfoFields = authInfo.getFields();
  return Promise.resolve(typeof authInfoFields.devHubUsername !== 'undefined');
}

/**
 * Returns the non-aliased username
 * @param usernameOrAlias
 */
async function getUsername(usernameOrAlias: string): Promise<string> {
  const username = await Aliases.fetch(usernameOrAlias);
  if (username) {
    return Promise.resolve(username);
  }
  return Promise.resolve(usernameOrAlias);
}

function setDefaultUsernameHasChangeTracking(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_username_has_change_tracking',
    val
  );
}

function setDefaultUsernameHasNoChangeTracking(val: boolean) {
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:default_username_has_no_change_tracking',
    val
  );
}

async function getDefaultUsernameOrAlias(): Promise<string | undefined> {
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

export function registerDefaultUsernameWatcher(
  context: vscode.ExtensionContext
) {
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
