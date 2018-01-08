/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { EOL } from 'os';
import { DebugLogEvent, LogEntry, NoOp } from '../events';

export class LogFileUtil {
  public readLogFile(logFilePath: string): string[] {
    try {
      const fileContent = fs.readFileSync(logFilePath).toString('utf-8');
      return fileContent.split(EOL);
    } catch (e) {
      return [];
    }
  }

  public parseLogEvent(logLine: string): DebugLogEvent {
    if (logLine.match(/[\d]{2}\.\d.*APEX_CODE.*SYSTEM.*/)) {
      return new LogEntry();
    }
    const fields = logLine.split('|');
    if (fields.length >= 3) {
      switch (fields[1]) {
        default:
          return new NoOp();
      }
    }

    return new NoOp();
  }
}
