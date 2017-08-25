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
import { CommandOutput } from '../utils/commandOutput';

export class SObjectDescribeGlobal {
  public async describeGlobal(
    projectPath: string,
    type: string
  ): Promise<string[]> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:schema:sobject:list')
        .withFlag('--sobjecttypecategory', type)
        .withArg('--json')
        .build(),
      { cwd: projectPath }
    ).execute();

    return this.getCmdResult(execution);
  }

  private async getCmdResult(execution: CommandExecution): Promise<string[]> {
    const outputHolder = new CommandOutput();
    execution.stderrSubject.subscribe(data =>
      outputHolder.setStdErr(data.toString())
    );

    return new Promise<
      string[]
    >(
      (
        resolve: (result: string[]) => void,
        reject: (reason: string) => void
      ) => {
        execution.processExitSubject.subscribe(
          data => {
            if (data != undefined && data.toString() === '0') {
              try {
                execution.stdoutSubject.subscribe(realData => {
                  const output = JSON.parse(realData.toString());
                  if (output && output.result) {
                    const describeResult = output.result as string[];
                    return resolve(describeResult);
                  } else {
                    reject(realData.toString());
                  }
                });
              } catch (e) {
                return reject(outputHolder.getStdOut());
              }
            } else {
              return reject(outputHolder.getStdErr());
            }
          },
          err => {
            console.log('error');
          },
          () => {
            console.log('completed');
          }
        );
      }
    );
  }
}
