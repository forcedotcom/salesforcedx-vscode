/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexDiagnosticSchema } from '../tests/types';

export type ApexDiagnostic = typeof ApexDiagnosticSchema.Type;

export const getDiagnostic = (record: { message?: string | null; stackTrace?: string | null }): ApexDiagnostic => {
  const { message, stackTrace } = record;
  const matches = stackTrace?.match(/(line (\d+), column (\d+))/);

  return {
    ...(message ? { exceptionMessage: message } : {}),
    ...(stackTrace ? { exceptionStackTrace: stackTrace } : {}),
    className: stackTrace ? stackTrace.split('.')[1] : undefined,
    ...(matches?.[2] && { lineNumber: Number(matches[2]) }),
    ...(matches?.[3] && { columnNumber: Number(matches[3]) })
  };
};
