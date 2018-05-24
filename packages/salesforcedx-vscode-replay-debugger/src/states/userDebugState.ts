/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { EXEC_ANON_SIGNATURE } from '../constants';
import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class UserDebugState implements DebugLogState {
  private readonly line: number;
  private message: string;

  constructor(fields: string[]) {
    this.line = parseInt(fields[2], 10);
    this.message = fields[fields.length - 1];
  }

  public getMessage(): string {
    return this.message;
  }

  public handle(logContext: LogContext): boolean {
    this.lookAheadAndAppend(logContext);
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

  public lookAheadAndAppend(logContext: LogContext): void {
    for (
      let i = logContext.getLogLinePosition() + 1;
      i < logContext.getLogLines().length;
      i++
    ) {
      // Get next log line as-is (no trimming)
      const nextLogLine = logContext.getLogLines()[i];
      // Check if this could be a debug log event
      if (nextLogLine.split('|').length >= 3) {
        break;
      }
      // If it's not a debug log event, assume it's in the user's
      this.message = `${this.message}${EOL}${nextLogLine}`;
      logContext.incrementLogLinePosition();
    }
  }
}
