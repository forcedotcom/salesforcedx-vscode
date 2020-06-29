/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type ExecuteAnonymousResponse = {
  result: {
    column: number;
    compiled: boolean;
    compileProblem: string;
    exceptionMessage: string;
    exceptionStackTrace: string;
    line: number;
    success: boolean;
    logs: string;
  };
};

enum logLevel {
  trace = 'trace',
  debug = 'debug',
  info = 'info',
  warn = 'warn',
  error = 'error',
  fatal = 'fatal'
}

type CommonOptions = {
  json?: boolean;
  loglevel?: logLevel;
};

export type ApexExecuteOptions = CommonOptions & {
  targetUsername?: string;
  apexCodeFile: string;
};

export type ApexLogGetOptions = CommonOptions & {
  numberOfLogs?: number;
  logId?: string;
};
