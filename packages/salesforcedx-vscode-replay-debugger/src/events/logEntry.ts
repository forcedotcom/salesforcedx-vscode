/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Source, StackFrame } from 'vscode-debugadapter';
import { LogFile } from '../core/logFile';
import { DebugLogEvent } from './debugLogEvent';

export class LogEntry implements DebugLogEvent {
  public handleThenStop(logFile: LogFile): boolean {
    const logFileName = logFile.getLogFileName();
    logFile
      .getFrames()
      .push(
        new StackFrame(
          0,
          '',
          new Source(
            logFileName,
            encodeURI('file://' + logFile.getLogFilePath())
          ),
          logFile.getLogLinePosition() + 1
        )
      );
    return true;
  }
}
