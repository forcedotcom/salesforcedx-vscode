/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandExecution } from './commandExecutor';

export class CommandOutput {
  private buffer = '';

  public async getCmdResult(execution: CommandExecution): Promise<string> {
    execution.stdoutSubject.subscribe(realData => {
      this.buffer += realData.toString();
    });
    execution.stderrSubject.subscribe(realData => {
      this.buffer += realData.toString();
    });

    return new Promise<
      string
    >((resolve: (result: string) => void, reject: (reason: string) => void) => {
      execution.processCloseSubject.subscribe(data => {
        if (data != undefined && data.toString() === '0') {
          return resolve(this.buffer);
        } else {
          reject(this.buffer);
        }
      });
    });
  }
}
