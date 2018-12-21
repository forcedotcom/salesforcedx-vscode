import { AuthInfo } from '@salesforce/core';
import * as os from 'os';
import * as path from 'path';
import fs = require('fs');
import 'rxjs/add/operator/toPromise';
import { isNullOrUndefined } from 'util';
export interface FileInfo {
  scratchAdminUsername?: string;
  devHubUsername?: string;
  isDevHub?: boolean;
}

export class OrgList {
  public async readFileAsync(fileData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(fileData, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data as string);
        }
      });
    });
  }

  public async getOrgList() {
    const authFilesArray = await AuthInfo.listAllAuthFiles();
    // let authInfoObjects: FileInfo[] = [];

    const parsedFiles = Promise.all(
      authFilesArray.map(fileName => {
        const filePath = path.join(os.homedir(), '.sfdx', fileName);
        return Promise.all([
          fs.stat(filePath, err => console.log(err)),
          this.readFileAsync(filePath).then(fileData => JSON.parse(fileData))
        ]);
      })
    );
    return parsedFiles;

    /*await authFilesArray.forEach(fileName => {
      const filePath = path.join(os.homedir(), '.sfdx', fileName);
      const fileExistsPromise = Promise.resolve(() =>
        fs.stat(filePath, err => {
          if (err) {
            console.log(err);
          }
        })
      );
      const exists = fs.stat(filePath, err => console.log(err));*/
    /*const fileExistsPromise = new Promise(() => {
        fs.stat(filePath, err => {
          if (err) {
            console.log(err);
          }
        });
      });*/
    /*let fileData: string;
      const readFilePromise = Promise.resolve(() => {
        fileData = fs.readFileSync(filePath, 'utf8');
      });

      const parseFilePromise = Promise.resolve(
        readFilePromise.then(() => {
          authInfoObjects.push(JSON.parse(fileData));
        })
      );
      return Promise.all([
        Promise.resolve(fileExistsPromise),
        Promise.resolve(readFilePromise),
        Promise.resolve(parseFilePromise)
      ]);
      console.log('Auth info so far' + authInfoObjects);
    });
    console.log(authInfoObjects);
    authInfoObjects = authInfoObjects.filter(fileData =>
      isNullOrUndefined(fileData.scratchAdminUsername)
    );*/
    /*
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
    console.log('This is the filtered array' + authInfoObjects);*/
  }
}
