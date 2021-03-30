/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nls } from '../i18n';
import { ApexDiagnostic } from '../utils';
import { ApexTestResultRecord, SyncTestFailure } from './types';

export function formatTestErrors(error: Error): Error {
  const matches = error.message?.match(
    /\bsObject type ["'](.*?)["'] is not supported\b/
  );
  if (matches && matches[0] && matches[1]) {
    error.message = nls.localize('invalidsObjectErr', [
      matches[1],
      error.message
    ]);
    return error;
  }

  return error;
}

export function getSyncDiagnostic(syncRecord: SyncTestFailure): ApexDiagnostic {
  const diagnostic: ApexDiagnostic = {
    exceptionMessage: syncRecord.message,
    exceptionStackTrace: syncRecord.stackTrace,
    className: syncRecord.stackTrace
      ? syncRecord.stackTrace.split('.')[1]
      : undefined,
    compileProblem: ''
  };

  const matches =
    syncRecord.stackTrace &&
    syncRecord.stackTrace.match(/(line (\d+), column (\d+))/);
  if (matches) {
    if (matches[2]) {
      diagnostic.lineNumber = Number(matches[2]);
    }
    if (matches[3]) {
      diagnostic.columnNumber = Number(matches[3]);
    }
  }
  return diagnostic;
}

export function getAsyncDiagnostic(
  asyncRecord: ApexTestResultRecord
): ApexDiagnostic {
  const diagnostic: ApexDiagnostic = {
    exceptionMessage: asyncRecord.Message,
    exceptionStackTrace: asyncRecord.StackTrace,
    className: asyncRecord.StackTrace
      ? asyncRecord.StackTrace.split('.')[1]
      : undefined,
    compileProblem: ''
  };

  const matches =
    asyncRecord.StackTrace &&
    asyncRecord.StackTrace.match(/(line (\d+), column (\d+))/);
  if (matches) {
    if (matches[2]) {
      diagnostic.lineNumber = Number(matches[2]);
    }
    if (matches[3]) {
      diagnostic.columnNumber = Number(matches[3]);
    }
  }
  return diagnostic;
}
