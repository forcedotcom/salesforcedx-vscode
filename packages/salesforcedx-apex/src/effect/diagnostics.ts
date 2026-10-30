/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Diagnostic data independent of editor ranges, files, or terminal output. */
export const ApexDiagnosticSchema = Schema.Struct({
  lineNumber: Schema.optional(Schema.Number),
  columnNumber: Schema.optional(Schema.Number),
  exceptionMessage: Schema.optional(Schema.NonEmptyString),
  compileProblem: Schema.optional(Schema.NonEmptyString),
  exceptionStackTrace: Schema.optional(Schema.NonEmptyString),
  className: Schema.optional(Schema.String)
}).annotations({ identifier: 'ApexDiagnostic' });
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
