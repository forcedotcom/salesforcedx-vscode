import { Aliases, AuthInfo } from '@salesforce/core';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import fs = require('fs');
import { isNullOrUndefined, promisify } from 'util';
import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
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
    const authFilesArray = await AuthInfo.listAllAuthFiles();

    if (authFilesArray === null || authFilesArray.length === 0) {
      return Promise.reject(
        new Error(nls.localize('error_retrieving_previous_authorizations'))
      );
    }
    const authInfoObjects = Promise.all(
      authFilesArray.map(fileName => {
        const filePath = path.join(os.homedir(), '.sfdx', fileName);
        return readFileAsync(filePath, 'utf8')
          .then(fileData => JSON.parse(fileData))
          .catch(err => null);
      })
    );
    return authInfoObjects;
  }

  public async filterAuthInfo(authInfoObjects: FileInfo[]) {
    authInfoObjects = authInfoObjects.filter(fileData =>
      isNullOrUndefined(fileData.scratchAdminUsername)
    );
    authInfoObjects = authInfoObjects.filter(fileData =>
      isNullOrUndefined(fileData.isDevHub)
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

let statusBarItem: StatusBarItem;

export async function updateOrgList() {
  const orgList = new OrgList();
  const authInfoObjects = await orgList.getAuthInfoObjects();
  const authUsernameList = await orgList.filterAuthInfo(authInfoObjects);
  return authUsernameList;
}

export async function setDefaultOrg(): Promise<
  CancelResponse | ContinueResponse<{}>
> {
  const orgList = await updateOrgList();
  orgList.unshift(
    nls.localize('force_auth_web_login_authorize_org_text'),
    nls.localize('force_org_create_default_scratch_org_text')
  );
  const selection = await vscode.window.showQuickPick(orgList);
  if (!selection) {
    return { type: 'CANCEL' };
  }

  if (selection === nls.localize('force_auth_web_login_authorize_org_text')) {
    vscode.commands.executeCommand('sfdx.force.auth.web.login');
    return {
      type: 'CONTINUE',
      data: {}
    };
  } else if (
    selection === nls.localize('force_org_create_default_scratch_org_text')
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
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 50);
    statusBarItem.command = 'sfdx.force.set.default.org';
    statusBarItem.show();
  }
  const editor = window.activeTextEditor;
  if (!editor) {
    statusBarItem.hide();
    return;
  }
  displayDefaultUsername();
}

export async function displayDefaultUsername() {
  const defaultUsernameorAlias = await getDefaultUsernameOrAlias();
  if (defaultUsernameorAlias) {
    statusBarItem.text = defaultUsernameorAlias;
  } else {
    statusBarItem.text = nls.localize('missing_default_org');
  }
}
