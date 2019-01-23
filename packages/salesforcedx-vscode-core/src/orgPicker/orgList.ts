/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo } from '@salesforce/core';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import fs = require('fs');
import { isNullOrUndefined, promisify } from 'util';
import { getDefaultUsernameOrAlias } from '../context/workspaceOrgType';
import { nls } from '../messages';

export interface FileInfo {
  scratchAdminUsername?: string;
  isDevHub?: boolean;
  username: string;
}
const readFileAsync = promisify(fs.readFile);
export class OrgList {
  public async getAuthInfoObjects() {
    const authFilesArray = await AuthInfo.listAllAuthFiles().catch(err => null);

    if (authFilesArray === null || authFilesArray.length === 0) {
      return null;
    }
    const authInfoObjects = Promise.all(
      authFilesArray.map(fileName => {
        const filePath = path.join(os.homedir(), '.sfdx', fileName);
        return readFileAsync(filePath, 'utf8')
          .then(fileData => JSON.parse(fileData))
          .catch(err => console.log(err));
      })
    );
    return authInfoObjects;
  }

  public async filterAuthInfo(authInfoObjects: FileInfo[]) {
    authInfoObjects = authInfoObjects.filter(fileData =>
      isNullOrUndefined(fileData.scratchAdminUsername)
    );
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
}

let statusBarItem: vscode.StatusBarItem;

export async function updateOrgList() {
  const orgList = new OrgList();
  const authInfoObjects = await orgList.getAuthInfoObjects();
  if (isNullOrUndefined(authInfoObjects)) {
    return null;
  }
  const authUsernameList = await orgList.filterAuthInfo(authInfoObjects);
  return authUsernameList;
}

export async function setDefaultOrg(): Promise<
  CancelResponse | ContinueResponse<{}>
> {
  let quickPickList = [
    '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text'),
    '$(plus) ' + nls.localize('force_org_create_default_scratch_org_text')
  ];
  const orgList = await updateOrgList();
  if (!isNullOrUndefined(orgList)) {
    quickPickList = quickPickList.concat(orgList);
  }
  const selection = await vscode.window.showQuickPick(quickPickList, {
    placeHolder: nls.localize('org_select_text')
  });
  if (!selection) {
    return { type: 'CANCEL' };
  }

  if (
    selection ===
    '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text')
  ) {
    vscode.commands.executeCommand('sfdx.force.auth.web.login');
    return {
      type: 'CONTINUE',
      data: {}
    };
  } else if (
    selection ===
    '$(plus) ' + nls.localize('force_org_create_default_scratch_org_text')
  ) {
    vscode.commands.executeCommand('sfdx.force.org.create');
    return { type: 'CONTINUE', data: {} };
  } else {
    const usernameOrAlias = selection.split(' ', 1);
    vscode.commands.executeCommand('sfdx.force.config.set', usernameOrAlias);
    return { type: 'CONTINUE', data: {} };
  }
}

export async function showOrg() {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50
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
  const defaultUsernameorAlias = await getDefaultUsernameOrAlias();
  if (defaultUsernameorAlias) {
    statusBarItem.text = `$(briefcase) ${defaultUsernameorAlias}`;
  } else {
    statusBarItem.text = nls.localize('missing_default_org');
  }
}
