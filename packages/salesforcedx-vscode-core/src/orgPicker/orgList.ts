import { AuthInfo } from '@salesforce/core';
import * as os from 'os';
import * as path from 'path';
import fs = require('fs');
import { isNull } from 'util';

export async function getOrgList(): Promise<string[]> {
  const authInfoArray = await AuthInfo.listAllAuthFiles();
  const orgAuthInfo = [];
  for (const i of authInfoArray) {
    const fileData = JSON.parse(
      fs.readFileSync(path.join(os.homedir(), '.sfdx', i), 'utf8')
    ) as string;

    const fileDataMap = fileData.split(',');

    if (
      fileDataMap[0] !== null &&
      fileDataMap[1] !== null &&
      fileDataMap[1] !== 'scratchAdminUsername'
    ) {
      orgAuthInfo.push(fileData);
    }

    console.log(fileData);
  }
  return AuthInfo.listAllAuthFiles();
}
