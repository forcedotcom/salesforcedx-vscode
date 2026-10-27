/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const soapEnv = 'soapenv:Envelope';
export const soapBody = 'soapenv:Body';
export const soapHeader = 'soapenv:Header';
export const executeAnonymousAction = 'executeAnonymous';

// Generic Connection.request uses xml2js: nil elements retain their attributes; empty elements may be {}.
const SoapText = Schema.transform(
  Schema.Union(
    Schema.String,
    Schema.Struct({ $: Schema.Struct({ 'xsi:nil': Schema.Literal('true') }) }),
    Schema.Record({ key: Schema.String, value: Schema.Never })
  ),
  Schema.NullOr(Schema.String),
  {
    strict: true,
    decode: value => (typeof value === 'string' ? value : null),
    encode: value => value ?? { $: { 'xsi:nil': 'true' as const } }
  }
);
const SoapInteger = Schema.Union(Schema.Int, Schema.NumberFromString.pipe(Schema.int()));

const resultFields = {
  compileProblem: Schema.NullOr(Schema.String),
  exceptionMessage: Schema.NullOr(Schema.String),
  exceptionStackTrace: Schema.NullOr(Schema.String)
};
const failureResultFields = { ...resultFields, line: Schema.Number, column: Schema.Number };
export const executionResultSchema = Schema.Union(
  Schema.Struct({ ...failureResultFields, compiled: Schema.Literal(false), success: Schema.Literal(false) }),
  Schema.Struct({ ...failureResultFields, compiled: Schema.Literal(true), success: Schema.Literal(false) }),
  Schema.Struct({
    ...resultFields,
    line: Schema.Literal(-1),
    column: Schema.Literal(-1),
    compiled: Schema.Literal(true),
    success: Schema.Literal(true)
  })
);

const invalidSessionErrorSchema = Schema.Struct({
  name: Schema.Literal('ERROR_HTTP_500'),
  message: Schema.String.pipe(Schema.pattern(/INVALID_SESSION_ID/))
});
export const isInvalidSessionError = Schema.is(invalidSessionErrorSchema);

/** SOAP response as parsed by Salesforce Core's generic Connection.request. */
export const soapResponseSchema = Schema.Struct({
  [soapEnv]: Schema.Struct({
    [soapHeader]: Schema.optional(
      Schema.Struct({ DebuggingInfo: Schema.optional(Schema.Struct({ debugLog: Schema.String })) })
    ),
    [soapBody]: Schema.Struct({
      executeAnonymousResponse: Schema.Struct({
        result: Schema.Struct({
          compiled: Schema.BooleanFromString,
          success: Schema.BooleanFromString,
          line: SoapInteger,
          column: SoapInteger,
          compileProblem: SoapText,
          exceptionMessage: SoapText,
          exceptionStackTrace: SoapText
        })
      })
    })
  })
});
