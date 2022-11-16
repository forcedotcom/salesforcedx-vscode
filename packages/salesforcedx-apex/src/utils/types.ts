/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

enum logLevel {
  trace = 'trace',
  debug = 'debug',
  info = 'info',
  warn = 'warn',
  error = 'error',
  fatal = 'fatal'
}

export const xmlCharMap: { [index: string]: string } = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;'
};

export type CommonOptions = {
  json?: boolean;
  loglevel?: logLevel;
};

export type ApexDiagnostic = {
  lineNumber?: number;
  columnNumber?: number;
  exceptionMessage: string;
  compileProblem: string;
  exceptionStackTrace: string;
  className?: string;
};

export type QueryResult<T = QueryRecord> = { records: T[] };
export type QueryRecord = { Id: string };
export type QueryRecords = {
  totalSize: number;
  records: IdRecord[];
};

export type DebugLevelRecord = {
  ApexCode: string;
  VisualForce: string;
};

export type TraceFlagRecord = {
  Id: string;
  LogType: string;
  DebugLevelId: string;
  StartDate: Date | undefined;
  ExpirationDate: Date | undefined;
  DebugLevel: DebugLevelRecord;
};

export type DataRecordResult = {
  id?: string;
  errors?: string[];
  success: boolean;
};

export type IdRecord = {
  Id: string;
};
