/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EXEC_ANON_SIGNATURE } from '../constants';
import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class UserDebugState implements DebugLogState {
  private readonly line: number;
  private readonly message: string;

  constructor(fields: string[]) {
    this.line = parseInt(fields[2]);
    this.message = fields[fields.length - 1];
  }

  public handle(logContext: LogContext): boolean {
    const frame = logContext.getTopFrame();
    if (frame) {
      logContext
        .getSession()
        .warnToDebugConsole(
          this.message,
          frame.source,
          frame.name === EXEC_ANON_SIGNATURE
            ? logContext.getExecAnonScriptLocationInDebugLog(this.line)
            : this.line
        );
    }
    return false;
  }
}
