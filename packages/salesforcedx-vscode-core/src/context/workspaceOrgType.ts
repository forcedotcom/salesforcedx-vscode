/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo } from '@salesforce/core';
import * as path from 'path';
import * as vscode from 'vscode';

import { ForceConfigGet } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export enum OrgType {
  SourceTracked,
  NonSourceTracked
}

export async function getWorkspaceOrgType(): Promise<OrgType> {
  const defaultUsernameOrAlias = await getDefaultUsernameOrAlias();
  const defaultUsernameIsSet = typeof defaultUsernameOrAlias !== 'undefined';

  if (defaultUsernameIsSet) {
    const username = await getUsername(defaultUsernameOrAlias!);
    const isScratchOrg = await isAScratchOrg(username);
    return isScratchOrg ? OrgType.SourceTracked : OrgType.NonSourceTracked;
  }

  const e = new Error('Defaultusername is not set');
  e.name = 'NoDefaultusernameSet';
  throw e;
}

export async function setupWorkspaceOrgType() {
  try {
    const orgType = await getWorkspaceOrgType();
    setDefaultUsernameHasChangeTracking(orgType === OrgType.SourceTracked);
    setDefaultUsernameHasNoChangeTracking(orgType === OrgType.NonSourceTracked);
  } catch (e) {
    if (e.name === 'NamedOrgNotFound') {
      // If the info for a default username cannot be found,
      // then assume that the org can be of either type
      setDefaultUsernameHasChangeTracking(true);
      setDefaultUsernameHasNoChangeTracking(true);
    } else if (e.name === 'NoDefaultusernameSet') {
      setDefaultUsernameHasChangeTracking(false);
      setDefaultUsernameHasNoChangeTracking(false);
    } else {
      throw e;
    }
  }
}

async function isAScratchOrg(username: string): Promise<boolean> {
  try {
    const authInfo = await AuthInfo.create(username);
    const authInfoFields = authInfo.getFields();
    return Promise.resolve(
      typeof authInfoFields.devHubUsername !== 'undefined'
    );
  } catch (e) {
    // If the info for a username cannot be found,
    // then the name of the exception will be 'NamedOrgNotFound'
    throw e;
  }
}

/**
 * Returns the non-aliased username
 * @param usernameOrAlias
 */
export async function getUsername(usernameOrAlias: string): Promise<string> {
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

export async function getDefaultUsernameOrAlias(): Promise<string | undefined> {
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
      path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        '.sfdx',
        'sfdx-config.json'
      )
    );
    sfdxConfigWatcher.onDidChange(uri => setupWorkspaceOrgType());
    sfdxConfigWatcher.onDidCreate(uri => setupWorkspaceOrgType());
    sfdxConfigWatcher.onDidDelete(uri => setupWorkspaceOrgType());
    context.subscriptions.push(sfdxConfigWatcher);
  }
}
