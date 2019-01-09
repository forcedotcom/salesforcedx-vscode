import { AuthInfo } from '@salesforce/core';
import * as os from 'os';
import * as path from 'path';
import fs = require('fs');
import 'rxjs/add/operator/toPromise';
import { isNullOrUndefined } from 'util';
import { promisify } from 'util';
import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
export interface FileInfo {
  scratchAdminUsername?: string;
  devHubUsername?: string;
  isDevHub?: boolean;
  username: string;
}
const readFileAsync = promisify(fs.readFile);
export class OrgList {
  public statusBarItem: StatusBarItem;
  public authFileObjects: FileInfo[];

  public async getAuthInfoObjects() {
    const authFilesArray = await AuthInfo.listAllAuthFiles();

    if (authFilesArray === null || authFilesArray.length === 0) {
      return Promise.reject(new Error('No previous authorizations found.'));
    }
    const authInfoPromise = Promise.all(
      authFilesArray.map(fileName => {
        const filePath = path.join(os.homedir(), '.sfdx', fileName);
        return readFileAsync(filePath, 'utf8')
          .then(fileData => JSON.parse(fileData))
          .catch(err => null);
      })
    ).then(result => this.authFileObjects);
    return this.authFileObjects;
  }

  public async filterAuthInfo(authInfoObjects: FileInfo[]) {
    authInfoObjects = authInfoObjects.filter(fileData =>
      isNullOrUndefined(fileData.scratchAdminUsername)
    );
    const scratchOrgs = authInfoObjects.filter(
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
    console.log('This is the filtered array' + authInfoObjects);
    return authInfoObjects;
  }
}

export async function updateOrgList() {
  const orgList = new OrgList();
  if (!orgList.statusBarItem) {
    orgList.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
  }

  const editor = window.activeTextEditor;
  if (!editor) {
    orgList.statusBarItem.hide();
    return;
  }

  const authInfoObjects = await orgList.getAuthInfoObjects();
  const orgInfoList = await orgList.filterAuthInfo(authInfoObjects);
  orgList.statusBarItem.text = orgInfoList[0].username;
  orgList.statusBarItem.show();
}

/*public dispose() {
    this.statusBarItem.dispose();
  }*/
