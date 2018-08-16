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
        // TODO: what should we do in this case? Expose all source commands by default?
        setDefaultOrgIsScratchOrg(true);
        setDefaultOrgIsNonScratchOrg(true);
        return;
      } else {
        throw e;
      }
    }
  }
  setDefaultOrgIsScratchOrg(defaultUsernameIsSet && isScratchOrg);
  setDefaultOrgIsNonScratchOrg(defaultUsernameIsSet && !isScratchOrg);
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
