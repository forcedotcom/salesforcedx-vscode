/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { HttpRequest } from '@jsforce/jsforce-node';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { action, soapBody, soapEnv, soapHeader } from '../execute/types.js';
import { encodeBody } from '../execute/utils.js';
import { messages } from '../i18n/i18n.js';
import {
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  causeMessage
} from './errors.js';

const operation = 'executeAnonymous';
class ApexRequestError extends Schema.TaggedError<ApexRequestError>()('ApexRequestError', {
  message: Schema.String,
  invalidSession: Schema.Boolean
}) {}

/** Apex source selected by the caller; file and terminal input belong to the host. */
export const ExecuteAnonymousOptionsSchema = Schema.Struct({ apexCode: Schema.String }).annotate({
  identifier: 'ExecuteAnonymousOptions'
});
export type ExecuteAnonymousOptions = typeof ExecuteAnonymousOptionsSchema.Type;

/** Execution details and the debug log returned by the Apex SOAP endpoint. */
const resultFields = {
  compileProblem: Schema.NullOr(Schema.String),
  line: Schema.Number,
  column: Schema.Number,
  exceptionMessage: Schema.NullOr(Schema.String),
  exceptionStackTrace: Schema.NullOr(Schema.String)
};
const ExecutionResultSchema = Schema.Union([
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(false), success: Schema.Literal(false) }),
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(true), success: Schema.Literal(false) }),
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(true), success: Schema.Literal(true) })
]);
export const ExecuteAnonymousOutcomeSchema = Schema.Struct({
  compiled: Schema.Literal(true),
  success: Schema.Literal(true),
  line: Schema.Number,
  column: Schema.Number,
  logBody: Schema.optional(Schema.String)
}).annotate({ identifier: 'ExecuteAnonymousOutcome' });
export type ExecuteAnonymousOutcome = typeof ExecuteAnonymousOutcomeSchema.Type;

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
// V3 rejects empty/whitespace numeric text; V4's NumberFromString alone coerces it to zero.
const SoapInteger = Schema.Union([
  Schema.Int,
  Schema.String.check(Schema.isPattern(/\S/)).pipe(
    Schema.decodeTo(Schema.NumberFromString),
    Schema.check(Schema.isInt())
  )
]);
const SoapBoolean = Schema.Literals(['true', 'false']).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform(value => value === 'true'),
    encode: SchemaGetter.transform(value => (value ? 'true' : 'false'))
  })
);
const SoapResponseSchema = Schema.Struct({
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

const operationError = (cause: unknown, message = causeMessage(cause)): ApexOperationError =>
  new ApexOperationError({ operation, message, cause: causeMessage(cause) });

// Tooling REST would require separate trace-flag, execution, and log-retrieval calls.
const buildRequest = (connection: Connection, code: string): HttpRequest => {
  const accessToken = connection.accessToken ?? '';
  return {
    method: 'POST',
    url: `${connection.instanceUrl}/services/Soap/s/${connection.version}/${accessToken.split('!')[0]}`,
    body: encodeBody(accessToken, code),
    headers: { 'content-type': 'text/xml', soapaction: action }
  };
};

const InvalidSessionErrorSchema = Schema.Struct({
  name: Schema.Literal('ERROR_HTTP_500'),
  message: Schema.String.check(Schema.isPattern(/INVALID_SESSION_ID/))
});
const isInvalidSession = Schema.is(InvalidSessionErrorSchema);

const parseResponse = (response: unknown) =>
  Schema.decodeUnknownEffect(SoapResponseSchema)(response).pipe(
    Effect.flatMap(({ [soapEnv]: envelope }) =>
      Schema.decodeUnknownEffect(ExecutionResultSchema)(envelope[soapBody].executeAnonymousResponse.result).pipe(
        // Keep absent and empty logs distinct for the class/CLI response contract.
        Effect.map(result => ({ ...result, logBody: envelope[soapHeader]?.DebuggingInfo?.debugLog }))
      )
    ),
    Effect.catchTag('SchemaError', cause =>
      Effect.fail(
        new ApexResponseDecodeError({
          operation,
          message: 'Invalid execute anonymous SOAP response',
          cause: causeMessage(cause)
        })
      )
    )
  );

type DecodedExecutionResult = Effect.Success<ReturnType<typeof parseResponse>>;

const refineExecutionResult = Effect.fn('Apex.refineExecutionResult')(function* (result: DecodedExecutionResult) {
  if (!result.compiled) {
    return yield* new ApexCompileError({
      operation,
      message: result.compileProblem || 'Anonymous Apex failed to compile.',
      line: result.line,
      column: result.column,
      compileProblem: result.compileProblem,
      logBody: result.logBody
    });
  }
  if (!result.success) {
    return yield* new ApexRuntimeError({
      operation,
      message: result.exceptionMessage || 'Anonymous Apex threw an unhandled exception.',
      line: result.line,
      column: result.column,
      exceptionMessage: result.exceptionMessage,
      exceptionStackTrace: result.exceptionStackTrace,
      logBody: result.logBody
    });
  }
  return {
    compiled: true as const,
    success: true as const,
    line: result.line,
    column: result.column,
    logBody: result.logBody
  };
});

const sendRequest = (connection: Connection, code: string) =>
  Effect.tryPromise({
    try: () => connection.request<unknown>(buildRequest(connection, code)),
    catch: cause => new ApexRequestError({ message: causeMessage(cause), invalidSession: isInvalidSession(cause) })
  });

/** Executes anonymous Apex and exposes compilation/runtime failures as typed errors. */
export const executeAnonymous = Effect.fn('Apex.executeAnonymous')(function* (
  connection: Connection,
  options: ExecuteAnonymousOptions
) {
  const { apexCode } = yield* Schema.decodeUnknownEffect(ExecuteAnonymousOptionsSchema)(options).pipe(
    Effect.catchTag('SchemaError', cause => Effect.fail(operationError(cause, messages.optionExecAnonError)))
  );
  return yield* sendRequest(connection, apexCode).pipe(
    // Only the first SOAP session fault triggers refresh. Rebuild the request after the token changes.
    Effect.catchTag('ApexRequestError', error =>
      error.invalidSession
        ? Effect.tryPromise({
            try: () => connection.request({ url: connection.baseUrl(), method: 'GET' }),
            catch: refreshCause => operationError(refreshCause)
          }).pipe(Effect.flatMap(() => sendRequest(connection, apexCode)))
        : Effect.fail(error)
    ),
    Effect.catchTag('ApexRequestError', error =>
      Effect.fail(
        operationError(
          error.message,
          error.invalidSession
            ? messages.authForAnonymousApexFailed
            : messages.unexpectedExecuteCommandError.replace('%s', () => error.message)
        )
      )
    ),
    Effect.flatMap(parseResponse),
    Effect.flatMap(refineExecutionResult)
  );
});
