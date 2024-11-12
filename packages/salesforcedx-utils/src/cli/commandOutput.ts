/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { stripAnsiInJson } from '../helpers';
import { CommandExecution } from '../types';
import { JSON_FLAG } from './commandBuilder';

export class CommandOutput {
  private stdoutBuffer = '';
  private stderrBuffer = '';

  public async getCmdResult(execution: CommandExecution): Promise<string> {
    const hasJsonEnabled = execution.command?.args?.some(arg => arg === JSON_FLAG);
    execution.stdoutSubject.subscribe(realData => {
      this.stdoutBuffer += realData.toString();
    });
    execution.stderrSubject.subscribe(realData => {
      this.stderrBuffer += realData.toString();
    });

    return new Promise<string>((resolve: (result: string) => void, reject: (reason: string) => void) => {
      execution.processExitSubject.subscribe(data => {
        if (data !== undefined && String(data) === '0') {
          return resolve(stripAnsiInJson(this.stdoutBuffer, hasJsonEnabled));
        } else {
          // Is the command is sf cli - if so, just use stdoutBuffer before stderrBuffer
          if (execution.command.command === 'sf') {
            return reject(
              stripAnsiInJson(this.stdoutBuffer, hasJsonEnabled) || stripAnsiInJson(this.stderrBuffer, hasJsonEnabled)
            );
          }
          return reject(
            stripAnsiInJson(this.stderrBuffer, hasJsonEnabled) || stripAnsiInJson(this.stdoutBuffer, hasJsonEnabled)
          );
        }
      });
    });
  }
}
