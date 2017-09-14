/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandExecution } from './commandExecutor';

export class CommandOutput {
  public async getCmdResult(execution: CommandExecution): Promise<string> {
    return new Promise<
      string
    >((resolve: (result: any) => void, reject: (reason: string) => void) => {
      execution.processExitSubject.subscribe(data => {
        if (data != undefined && data.toString() === '0') {
          execution.stdoutSubject.subscribe(realData => {
            return resolve(realData.toString());
          });
        } else {
          execution.stderrSubject.subscribe(realData => {
            reject(realData.toString());
          });
        }
      });
    });
  }
}
