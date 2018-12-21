import { AuthInfo } from '@salesforce/core';
import * as os from 'os';
import * as path from 'path';
import fs = require('fs');
import 'rxjs/add/operator/toPromise';
import { isNullOrUndefined } from 'util';
import { promisify } from 'util';
export interface FileInfo {
  scratchAdminUsername?: string;
  devHubUsername?: string;
  isDevHub?: boolean;
}
const readFileAsync = promisify(fs.readFile);
const stat = promisify(fs.stat);

export class OrgList {
  public async getOrgList() {
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
        /* waiting on whether the stat is neccesary or not, if not then the PROMISE.ALL is not needed
        return Promise.all([
          stat(filePath).catch(err => null),
          readFileAsync(filePath, 'utf8')
            .then(fileData => JSON.parse(fileData))
            .catch(err => null)
        ]);*/
      })
    );
    return authInfoObjects;
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
  }
}
