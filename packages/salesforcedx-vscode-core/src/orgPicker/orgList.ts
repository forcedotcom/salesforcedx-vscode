/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo, AuthInfoConfig } from '@salesforce/core';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { readFileSync } from 'fs';
import * as path from 'path';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { OrgAuthInfo } from '../util';

export interface FileInfo {
  scratchAdminUsername?: string;
  isDevHub?: boolean;
  username: string;
  devHubUsername?: string;
}
export class OrgList {
  public async getAuthInfoObjects() {
    const authFilesArray = await AuthInfo.listAllAuthFiles().catch(err => null);

    if (authFilesArray === null || authFilesArray.length === 0) {
      return null;
    }
    const authInfoObjects: FileInfo[] = [];
    for (const username of authFilesArray) {
      try {
        const filePath = path.join(
          await AuthInfoConfig.resolveRootFolder(true),
          '.sfdx',
          username
        );
        const fileData = readFileSync(filePath, 'utf8');
        authInfoObjects.push(JSON.parse(fileData));
      } catch (e) {
        console.log(e);
      }
    }
    return authInfoObjects;
  }

  public async filterAuthInfo(authInfoObjects: FileInfo[]) {
    authInfoObjects = authInfoObjects.filter(fileData =>
      isNullOrUndefined(fileData.scratchAdminUsername)
    );

    const defaultDevHubUsernameorAlias = await getDefaultDevHubUsernameorAlias();
    if (defaultDevHubUsernameorAlias) {
      const defaultDevHubUsername = await OrgAuthInfo.getUsername(
        defaultDevHubUsernameorAlias
      );
      authInfoObjects = authInfoObjects.filter(
        fileData =>
          isNullOrUndefined(fileData.devHubUsername) ||
          (!isNullOrUndefined(fileData.devHubUsername) &&
            fileData.devHubUsername === defaultDevHubUsername)
      );
    }

    const authUsernames = authInfoObjects.map(file => file.username);
    const aliases = await Aliases.create(Aliases.getDefaultOptions());
    const authList = [];
    for (const username of authUsernames) {
      const alias = await aliases.getKeysByValue(username);
      if (alias.length > 0) {
        authList.push(alias + ' - ' + username);
      } else {
        authList.push(username);
      }
    }
    return authList;
  }

  public async updateOrgList() {
    const authInfoObjects = await this.getAuthInfoObjects();
    if (isNullOrUndefined(authInfoObjects)) {
      return null;
    }
    const authUsernameList = await this.filterAuthInfo(authInfoObjects);
    return authUsernameList;
  }
}

let statusBarItem: vscode.StatusBarItem;

export async function setDefaultOrg(): Promise<
  CancelResponse | ContinueResponse<{}>
> {
  let quickPickList = [
    '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text'),
    '$(plus) ' + nls.localize('force_org_create_default_scratch_org_text')
  ];
  const defaultDevHubUsernameorAlias = await getDefaultDevHubUsernameorAlias();
  if (isNullOrUndefined(defaultDevHubUsernameorAlias)) {
    quickPickList.push(
      '$(plus) ' + nls.localize('force_auth_web_login_authorize_dev_hub_text')
    );
  }
  const orgList = new OrgList();
  const authInfoList = await orgList.updateOrgList();
  if (!isNullOrUndefined(authInfoList)) {
    quickPickList = quickPickList.concat(authInfoList);
  }

  const selection = await vscode.window.showQuickPick(quickPickList, {
    placeHolder: nls.localize('org_select_text')
  });

  if (!selection) {
    return { type: 'CANCEL' };
  }
  switch (selection) {
    case '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text'): {
      vscode.commands.executeCommand('sfdx.force.auth.web.login');
      return {
        type: 'CONTINUE',
        data: {}
      };
    }
    case '$(plus) ' +
      nls.localize('force_auth_web_login_authorize_dev_hub_text'): {
      vscode.commands.executeCommand('sfdx.force.auth.dev.hub');
      return { type: 'CONTINUE', data: {} };
    }
    case '$(plus) ' +
      nls.localize('force_org_create_default_scratch_org_text'): {
      vscode.commands.executeCommand('sfdx.force.org.create');
      return { type: 'CONTINUE', data: {} };
    }
    default: {
      const usernameOrAlias = selection.split(' ', 1);
      vscode.commands.executeCommand('sfdx.force.config.set', usernameOrAlias);
      return { type: 'CONTINUE', data: {} };
    }
  }
}

export async function showDefaultOrg() {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      49
    );
    statusBarItem.command = 'sfdx.force.set.default.org';
    statusBarItem.show();
  }
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    statusBarItem.hide();
    return;
  }
  await displayDefaultUsername();
}

export async function displayDefaultUsername() {
  let defaultUsernameorAlias: string | undefined;
  if (
    vscode.workspace.workspaceFolders instanceof Array &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    defaultUsernameorAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(
      vscode.workspace.workspaceFolders[0].uri.fsPath
    );
  }
  if (defaultUsernameorAlias) {
    statusBarItem.text = `$(plug) ${defaultUsernameorAlias}`;
  } else {
    statusBarItem.text = nls.localize('missing_default_org');
  }
}

export async function getDefaultDevHubUsernameorAlias(): Promise<
  string | undefined
> {
  if (
    vscode.workspace.workspaceFolders instanceof Array &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    return OrgAuthInfo.getDefaultDevHubUsernameOrAlias(
      vscode.workspace.workspaceFolders[0].uri.fsPath
    );
  }
}
