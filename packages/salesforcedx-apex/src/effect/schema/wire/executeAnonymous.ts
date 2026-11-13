/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';

export const soapEnv = 'soapenv:Envelope';
export const soapBody = 'soapenv:Body';
export const soapHeader = 'soapenv:Header';

// Generic Connection.request uses xml2js: nil elements retain their attributes; empty elements may be {}.
const SoapText = Schema.Union([
  Schema.String,
  Schema.Struct({ $: Schema.Struct({ 'xsi:nil': Schema.Literal('true') }) }),
  Schema.Record(Schema.String, Schema.Never)
]).pipe(
  Schema.decodeTo(Schema.NullOr(Schema.String), {
    decode: SchemaGetter.transform(value => (typeof value === 'string' ? value : null)),
    encode: SchemaGetter.transform(value => value ?? { $: { 'xsi:nil': 'true' as const } })
  })
);
const SoapIntegerText = Schema.String.check(Schema.isPattern(/\S/u)).pipe(
  Schema.decodeTo(Schema.Int, {
    decode: SchemaGetter.transform(Number),
    encode: SchemaGetter.transform(String)
  })
);
const SoapInteger = Schema.Union([Schema.Int, SoapIntegerText]);
const SoapBoolean = Schema.Literals(['true', 'false']).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform(value => value === 'true'),
    encode: SchemaGetter.transform(value => (value ? 'true' : 'false'))
  })
);

const resultFields = {
  compileProblem: Schema.NullOr(Schema.String),
  exceptionMessage: Schema.NullOr(Schema.String),
  exceptionStackTrace: Schema.NullOr(Schema.String)
};
const failureResultFields = { ...resultFields, line: Schema.Number, column: Schema.Number };
export const executionResultSchema = Schema.Union([
  Schema.Struct({ ...failureResultFields, compiled: Schema.Literal(false), success: Schema.Literal(false) }),
  Schema.Struct({ ...failureResultFields, compiled: Schema.Literal(true), success: Schema.Literal(false) }),
  Schema.Struct({
    ...resultFields,
    line: Schema.Literal(-1),
    column: Schema.Literal(-1),
    compiled: Schema.Literal(true),
    success: Schema.Literal(true)
  })
]);

const invalidSessionErrorSchema = Schema.Struct({
  name: Schema.Literal('ERROR_HTTP_500'),
  message: Schema.String.check(Schema.isPattern(/INVALID_SESSION_ID/u))
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
          compiled: SoapBoolean,
          success: SoapBoolean,
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
