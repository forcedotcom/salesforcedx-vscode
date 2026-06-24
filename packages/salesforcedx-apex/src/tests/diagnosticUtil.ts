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
  if (matches?.[0] && matches?.[1]) {
    error.message = nls.localize('invalidsObjectErr', [
      matches[1],
      error.message
    ]);
    return error;
  }

  return error;
}

export function getDiagnostic(
  record: SyncTestFailure | ApexTestResultRecord
): ApexDiagnostic {
  const { message, stackTrace } =
    'message' in record
      ? record
      : {
          message: record.Message,
          stackTrace: record.StackTrace
        };

  const matches = stackTrace?.match(/(line (\d+), column (\d+))/);

  return {
    exceptionMessage: message,
    exceptionStackTrace: stackTrace,
    className: stackTrace ? stackTrace.split('.')[1] : undefined,
    compileProblem: '',
    ...(matches && matches[2] && { lineNumber: Number(matches[2]) }),
    ...(matches && matches[3] && { columnNumber: Number(matches[3]) })
  };
}
