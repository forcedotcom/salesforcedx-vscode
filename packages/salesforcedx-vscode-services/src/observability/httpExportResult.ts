/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type ExportResult, ExportResultCode } from '@opentelemetry/core';

export const exportResultFromHttpStatus = (status: number, failureMessage: (status: number) => string): ExportResult =>
  status >= 200 && status < 300
    ? { code: ExportResultCode.SUCCESS }
    : { code: ExportResultCode.FAILED, error: new Error(failureMessage(status)) };
