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
