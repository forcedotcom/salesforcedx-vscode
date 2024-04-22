/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  FieldValue,
  Fields,
  ILogger,
  LogLine
} from '@salesforce/vscode-service-provider';

export class CoreLoggerService implements ILogger {
  getName(): string {
    throw new Error('Method not implemented.');
  }
  getLevel(): number {
    throw new Error('Method not implemented.');
  }
  setLevel(level?: number | undefined): ILogger {
    throw new Error('Method not implemented.');
  }
  shouldLog(level: number): boolean {
    throw new Error('Method not implemented.');
  }
  getBufferedRecords(): LogLine[] {
    throw new Error('Method not implemented.');
  }
  readLogContentsAsText(): string {
    throw new Error('Method not implemented.');
  }
  child(name: string, fields?: Fields | undefined): ILogger {
    throw new Error('Method not implemented.');
  }
  addField(name: string, value: FieldValue): ILogger {
    throw new Error('Method not implemented.');
  }
  trace(...args: unknown[]): ILogger {
    throw new Error('Method not implemented.');
  }
  debug(...args: unknown[]): ILogger {
    throw new Error('Method not implemented.');
  }
  info(...args: unknown[]): ILogger {
    throw new Error('Method not implemented.');
  }
  warn(...args: unknown[]): ILogger {
    throw new Error('Method not implemented.');
  }
  error(...args: unknown[]): ILogger {
    throw new Error('Method not implemented.');
  }
  fatal(...args: unknown[]): ILogger {
    throw new Error('Method not implemented.');
  }
}

export const getCoreLoggerService = (loggerName: string): ILogger => {
  return new CoreLoggerService();
};
