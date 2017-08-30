/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import { SObjectDescribe } from '../describe';


export class FauxClassGenerator {
  public async generate(projectPath: string, type: string) {
    const describe = new SObjectDescribe();
    const sobjects = await describe.describeGlobal(projectPath, type);
    console.log(sobjects.length);
    for (let i = 0; i < sobjects.length; i++) {
      const sobject = await describe.describeSObject(projectPath, sobjects[i]);
      console.log(sobject.name);
      this.generateFauxClass(projectPath, sobject);
    }
  }

  private async generateFauxClass(
    projectPath: string,
    sobject: any
  ): Promise<void> {
    const folderPath = path.join(projectPath, '.sfdx', 'sobjects');
    if (!fs.existsSync(folderPath)) {
      //fs.mkdirSync(folderPath);
    }
    //const isCustom = sobject.custom;
  }
}
