import { Aliases, AuthInfo } from '@salesforce/core';
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
  devHubUsername?: string;
  isDevHub?: boolean;
  username: string;
}
const readFileAsync = promisify(fs.readFile);
export class OrgList {
  public authFileObjects: FileInfo[];

  public async getAuthInfoObjects() {
    const authFilesArray = await AuthInfo.listAllAuthFiles();

    if (authFilesArray === null || authFilesArray.length === 0) {
      return Promise.reject(new Error('No previous authorizations found.'));
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

    // functionality to filter for different org types
    /*const scratchOrgs = authInfoObjects.filter(
      fileData => !isNullOrUndefined(fileData.devHubUsername)
    );
    const devHubs = authInfoObjects.filter(
      fileData => !isNullOrUndefined(fileData.isDevHub) && fileData.isDevHub
    );
    // const nonScratchorDev = authInfoObjects.reduce()
    authInfoObjects.forEach(authInfo =>
      console.log('All auth Info' + authInfo)
    );
    scratchOrgs.forEach(scratchOrg =>
      console.log('These are scratch orgs' + scratchOrg)
    );
    devHubs.forEach(devHub => console.log('These are dev hubs' + devHub));
    console.log('This is the filtered array' + authInfoObjects);*/
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
  const orgInfoList = await orgList.filterAuthInfo(authInfoObjects);
  return orgInfoList;
}

export async function setDefaultOrg() {
  const orgList = await updateOrgList();
  orgList.unshift(
    nls.localize('force_auth_web_login_authorize_org_text'),
    nls.localize('force_org_create_default_scratch_org_text')
  );
  const selection = await vscode.window.showQuickPick(orgList);
  return selection ? { type: 'CONTINUE', data: selection } : { type: 'CANCEL' };
}

export async function showOrg() {
  if (!statusBarItem) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 50);
    statusBarItem.command = 'sfdx.force.set.default.org';
    statusBarItem.show();
    console.log('should have shown the status bar item');
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
    statusBarItem.text = 'No default org set';
  }
}
