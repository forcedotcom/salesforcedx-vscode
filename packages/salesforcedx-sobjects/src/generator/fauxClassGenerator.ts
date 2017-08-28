/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import * as path from 'path';
import { SObjectDescribe, SObjectDescribeGlobal } from '../describe';
import { CommandOutput } from '../utils/commandOutput';

export class FauxClassGenerator {
  private describeResult: string[];

  public async generate(projectPath: string, type: string) {
    const describeGlobal = new SObjectDescribeGlobal();
    const describe = new SObjectDescribe();
    const sobjects = await describeGlobal.describeGlobal(projectPath, type);
    console.log(sobjects.length);
    for (let i = 0; i < sobjects.length; i++) {
      const describeResult = await describe.describe(projectPath, sobjects[i]);
      if (describeResult && describeResult.result) {
        const sobject = describeResult.result;
        //this.generateFauxClass(projectPath, sobject);
      }
    }
  }

  private async generateFauxClass(
    projectPath: string,
    sobject: any
  ): Promise<void> {
    const folderPath = path.join(projectPath, '.sfdx', 'sobjects');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const isCustom = sobject.custom;
  }
}
