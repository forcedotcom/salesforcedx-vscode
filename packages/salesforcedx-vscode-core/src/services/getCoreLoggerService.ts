/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldValue, Fields, LoggerInterface, LogLine, LoggerLevelValue } from '@salesforce/vscode-service-provider';

export class CoreLoggerService implements LoggerInterface {
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
  setLevel(level?: LoggerLevelValue): LoggerInterface {
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
  child(name: string, fields?: Fields | undefined): LoggerInterface {
    return new CoreLoggerService(`${this.getName()}.childLogger`);
  }
  addField(name: string, value: FieldValue): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  trace(...args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  debug(...args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  info(...args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  warn(...args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  error(...args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  fatal(...args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
}

export const getCoreLoggerService = (loggerName: string): LoggerInterface => {
  return new CoreLoggerService(loggerName);
};
