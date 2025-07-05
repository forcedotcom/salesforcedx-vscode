/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldValue, Fields, LoggerInterface, LogLine, LoggerLevelValue } from '@salesforce/vscode-service-provider';

export class CoreLoggerService implements LoggerInterface {
  private level: LoggerLevelValue = 0;
  constructor(private loggerName: string) {
    this.loggerName = loggerName;
  }
  public getName(): string {
    return this.loggerName;
  }
  public getLevel(): LoggerLevelValue {
    return this.level;
  }
  public setLevel(level?: LoggerLevelValue): LoggerInterface {
    this.level = level ?? 0;
    return this;
  }
  public shouldLog(_level: number): boolean {
    return true;
  }
  public getBufferedRecords(): LogLine[] {
    return [];
  }
  public readLogContentsAsText(): string {
    return '';
  }
  public child(_name: string, _fields?: Fields | undefined): LoggerInterface {
    return new CoreLoggerService(`${this.getName()}.childLogger`);
  }
  public addField(_name: string, _value: FieldValue): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  public trace(..._args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  public debug(..._args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  public info(..._args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  public warn(..._args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  public error(..._args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
  public fatal(..._args: unknown[]): LoggerInterface {
    throw new Error('Method not implemented.');
  }
}

export const getCoreLoggerService = (loggerName: string): LoggerInterface => new CoreLoggerService(loggerName);
