/*
 * Copyright (c) 2026, salesforce.com, inc.
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
    this.line = parseInt(fields.at(-1) ?? '0', 10);
  }

  public handle(logContext: LogContext): boolean {
    const frame = logContext.getTopFrame();
    if (frame) {
      if (frame.name === EXEC_ANON_SIGNATURE) {
        frame.line = logContext.getAnonApexFilePath()
          ? this.line + logContext.getAnonApexLineOffset()
          : logContext.getExecAnonScriptLocationInDebugLog(this.line);
      } else {
        frame.line = this.line;
      }
    }
    return true;
  }
}
