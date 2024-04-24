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
  LogLine,
  LoggerLevelValue
} from '@salesforce/vscode-service-provider';

export class CoreLoggerService implements ILogger {
  private level: LoggerLevelValue = 0;
  public constructor(private loggerName: string) {
    this.loggerName = loggerName;
  }
  getName(): string {
    return this.loggerName;
  }
  getLevel(): LoggerLevelValue {
    return this.level;
  }
  setLevel(level?: LoggerLevelValue): ILogger {
    this.level = level ?? 0;
    return this;
  }
  shouldLog(level: number): boolean {
    return true;
  }
  getBufferedRecords(): LogLine[] {
    return [];
  }
  readLogContentsAsText(): string {
    return '';
  }
  child(name: string, fields?: Fields | undefined): ILogger {
    return new CoreLoggerService(`${this.getName()}.childLogger`);
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
  return new CoreLoggerService(loggerName);
};
