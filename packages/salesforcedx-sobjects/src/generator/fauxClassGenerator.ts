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
import { SObjectDescribe, SObjectDescribeGlobal } from '../describe';
import { CommandOutput } from '../utils/commandOutput';

export class FauxClassGenerator {
  private describeResult: string[];

  public async generate(projectPath: string) {
    const describeGlobal = new SObjectDescribeGlobal();
    const describe = new SObjectDescribe();
    const sobjects = await describeGlobal.describeGlobal(projectPath);
    console.log(sobjects.length);
    for (let i = 0; i < sobjects.length && i < 5; i++) {
      const describeResult = await describe.describe(projectPath, sobjects[i]);
      if (describeResult && describeResult.result) {
        //generateFauxClass(sobject.result);
      }
      console.log('i: ' + i);
    }
  }

  public async generateFauxClass(sobject: any): Promise<void> {
    let subscribeAccept: () => void, subscribeReject: () => void;
    const returnPromise = new Promise<
      void
    >((resolve: () => void, reject: () => void) => {
      subscribeAccept = resolve;
      subscribeReject = reject;
    });
    return returnPromise;
  }
}
