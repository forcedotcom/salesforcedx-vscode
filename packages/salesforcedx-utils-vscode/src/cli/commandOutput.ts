/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandExecution } from './commandExecutor';

export class CommandOutput {
  private stdoutBuffer = '';
  private stderrBuffer = '';

  public async getCmdResult(execution: CommandExecution): Promise<string> {
    execution.stdoutSubject.subscribe(realData => {
      this.stdoutBuffer += realData.toString();
    });
    execution.stderrSubject.subscribe(realData => {
      this.stderrBuffer += realData.toString();
    });

    return new Promise<
      string
    >((resolve: (result: string) => void, reject: (reason: string) => void) => {
      execution.processExitSubject.subscribe(data => {
        if (data !== undefined && data.toString() === '0') {
          return resolve(this.stdoutBuffer);
        } else {
          reject(this.stderrBuffer);
        }
      });
    });
  }
}
