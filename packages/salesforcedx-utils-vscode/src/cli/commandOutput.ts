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

  public async getCmdResult(execution: CommandExecution): Promise<any> {
    const outputHolder = new CommandOutput();
    execution.stderrSubject.subscribe(data =>
      outputHolder.setStdErr(data.toString())
    );

    return new Promise<
      any
    >((resolve: (result: any) => void, reject: (reason: string) => void) => {
      execution.processExitSubject.subscribe(data => {
        if (data != undefined && data.toString() === '0') {
          try {
            execution.stdoutSubject.subscribe(realData => {
              const cmdOutput = realData.toString();
              const cmdResult = JSON.parse(cmdOutput.toString());
              if (cmdResult && cmdResult.result) {
                return resolve(cmdResult.result);
              }
            });
          } catch (e) {
            return reject(outputHolder.getStdOut());
          }
        } else {
          return reject(outputHolder.getStdErr());
        }
      });
    });
  }
}
