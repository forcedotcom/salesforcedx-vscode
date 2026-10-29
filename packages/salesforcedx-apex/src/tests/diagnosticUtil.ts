/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getDiagnostic as getTestDiagnostic } from '../effect/diagnostics';
import { nls } from '../i18n';
import { type ApexDiagnostic } from '../utils';
import { type ApexTestResultRecord, type SyncTestFailure } from './types';

export function formatTestErrors(error: Error): Error {
  const matches = error.message?.match(/\bsObject type ["'](.*?)["'] is not supported\b/);
  if (matches?.[0] && matches?.[1]) {
    error.message = nls.localize('invalidsObjectErr', [matches[1], error.message]);
    return error;
  }

  return error;
}

export function getDiagnostic(record: SyncTestFailure | ApexTestResultRecord): ApexDiagnostic {
  return getTestDiagnostic('id' in record ? record : { message: record.Message, stackTrace: record.StackTrace });
}
