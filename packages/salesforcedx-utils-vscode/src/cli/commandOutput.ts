/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandExecution } from './commandExecutor';

export class CommandOutput {
  private objectId: string;
  private stdErr: string;
  private stdOut: string;

  public setId(id: string): void {
    this.objectId = id;
  }

  public setStdErr(err: string): void {
    this.stdErr = err;
  }

  public setStdOut(out: string): void {
    this.stdOut = out;
  }

  public getId(): string {
    return this.objectId;
  }

  public getStdErr(): string {
    return this.stdErr;
  }

  public getStdOut(): string {
    return this.stdOut;
  }

  public async getCmdResult(execution: CommandExecution): Promise<string> {
    return new Promise<
      any
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
