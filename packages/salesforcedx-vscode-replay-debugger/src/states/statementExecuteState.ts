/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EXEC_ANON_SIGNATURE } from '../constants';
import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class StatementExecuteState implements DebugLogState {
  private readonly line: number;

  constructor(fields: string[]) {
    this.line = parseInt(fields[fields.length - 1], 10);
  }

  public handle(logContext: LogContext): boolean {
    const frame = logContext.getTopFrame();
    if (frame) {
      frame.line =
        frame.name === EXEC_ANON_SIGNATURE
          ? logContext.getExecAnonScriptLocationInDebugLog(this.line)
          : this.line;
    }
    return true;
  }
}
