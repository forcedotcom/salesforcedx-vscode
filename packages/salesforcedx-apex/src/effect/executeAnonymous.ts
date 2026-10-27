/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { HttpRequest } from '@jsforce/jsforce-node';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { encodeBody } from '../execute/utils';
import { messages } from '../i18n/i18n';
import { causeMessage } from './errors';
import {
  ApexCompileError,
  ApexOperationError,
  ApexRequestError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  InvalidSessionError
} from './schema/errors';
import { ExecuteAnonymousOptionsSchema, type ExecuteAnonymousOptions } from './schema/executeAnonymous';
import {
  executeAnonymousAction,
  executionResultSchema,
  isInvalidSessionError,
  soapBody,
  soapEnv,
  soapHeader,
  soapResponseSchema
} from './schema/wire/executeAnonymous';

const operation = 'executeAnonymous';
const optionalLogBody = (logBody: string | undefined) => (isUndefined(logBody) ? {} : { logBody });
<<<<<<< HEAD

class InvalidSessionError extends Schema.TaggedError<InvalidSessionError>()('InvalidSessionError', {
  message: Schema.String
}) {}

class ApexRequestError extends Schema.TaggedError<ApexRequestError>()('ApexRequestError', {
  message: Schema.String
}) {}

/** Apex source selected by the caller; file and terminal input belong to the host. */
export const ExecuteAnonymousOptionsSchema = Schema.Struct({ apexCode: Schema.String }).annotations({
  identifier: 'ExecuteAnonymousOptions'
});
export type ExecuteAnonymousOptions = typeof ExecuteAnonymousOptionsSchema.Type;

/** Execution details and the debug log returned by the Apex SOAP endpoint. */
const resultFields = {
  compileProblem: Schema.NullOr(Schema.String),
  exceptionMessage: Schema.NullOr(Schema.String),
  exceptionStackTrace: Schema.NullOr(Schema.String)
};
const failureResultFields = { ...resultFields, line: Schema.Number, column: Schema.Number };
const ExecutionResultSchema = Schema.Union(
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
export const ExecuteAnonymousOutcomeSchema = Schema.Struct({
  compiled: Schema.Literal(true),
  success: Schema.Literal(true),
  logBody: Schema.optional(Schema.String)
}).annotations({ identifier: 'ExecuteAnonymousOutcome' });
export type ExecuteAnonymousOutcome = typeof ExecuteAnonymousOutcomeSchema.Type;

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
const SoapResponseSchema = Schema.Struct({
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
=======
>>>>>>> origin/sm/W-23839447

const operationError = (cause: unknown, message = causeMessage(cause)): ApexOperationError =>
  new ApexOperationError({ operation, message, cause: causeMessage(cause) });

// Tooling REST would require separate trace-flag, execution, and log-retrieval calls.
const buildRequest = (connection: Connection, code: string): HttpRequest => {
  const accessToken = connection.accessToken ?? '';
  return {
    method: 'POST',
    url: `${connection.instanceUrl}/services/Soap/s/${connection.version}/${accessToken.split('!')[0]}`,
    body: encodeBody(accessToken, code),
    headers: { 'content-type': 'text/xml', soapaction: executeAnonymousAction }
  };
};

const parseResponse = (response: unknown) =>
  Schema.decodeUnknown(soapResponseSchema)(response).pipe(
    Effect.flatMap(({ [soapEnv]: envelope }) =>
<<<<<<< HEAD
      Schema.decodeUnknown(ExecutionResultSchema)(envelope[soapBody].executeAnonymousResponse.result).pipe(
=======
      Schema.decodeUnknown(executionResultSchema)(envelope[soapBody].executeAnonymousResponse.result).pipe(
>>>>>>> origin/sm/W-23839447
        Effect.map(result => ({ ...result, ...optionalLogBody(envelope[soapHeader]?.DebuggingInfo?.debugLog) }))
      )
    ),
    Effect.catchTag('ParseError', cause =>
      Effect.fail(
        new ApexResponseDecodeError({
          operation,
          message: 'Invalid execute anonymous SOAP response',
          cause: causeMessage(cause)
        })
      )
    )
  );

type DecodedExecutionResult = Effect.Effect.Success<ReturnType<typeof parseResponse>>;

const refineExecutionResult = Effect.fn('Apex.refineExecutionResult')(function* (result: DecodedExecutionResult) {
  if (!result.compiled) {
    return yield* new ApexCompileError({
      operation,
      message: result.compileProblem || 'Anonymous Apex failed to compile.',
      line: result.line,
      column: result.column,
      compileProblem: result.compileProblem,
      ...optionalLogBody(result.logBody)
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
      ...optionalLogBody(result.logBody)
    });
  }
  return {
    compiled: true as const,
    success: true as const,
    ...optionalLogBody(result.logBody)
  };
});

const sendRequest = (connection: Connection, code: string) =>
  Effect.tryPromise({
    try: () => connection.request<unknown>(buildRequest(connection, code)),
    catch: cause =>
<<<<<<< HEAD
      isInvalidSession(cause)
=======
      isInvalidSessionError(cause)
>>>>>>> origin/sm/W-23839447
        ? new InvalidSessionError({ message: causeMessage(cause) })
        : new ApexRequestError({ message: causeMessage(cause) })
  });

/** Executes anonymous Apex and exposes compilation/runtime failures as typed errors. */
export const executeAnonymous = Effect.fn('Apex.executeAnonymous')(function* (
  connection: Connection,
  options: ExecuteAnonymousOptions
) {
  const { apexCode } = yield* Schema.decodeUnknown(ExecuteAnonymousOptionsSchema)(options).pipe(
    Effect.catchTag('ParseError', cause => Effect.fail(operationError(cause, messages.optionExecAnonError)))
  );
  return yield* sendRequest(connection, apexCode).pipe(
    // Only the first SOAP session fault triggers refresh. Rebuild the request after the token changes.
    Effect.catchTag('InvalidSessionError', () =>
      Effect.tryPromise({
        try: () => connection.request({ url: connection.baseUrl(), method: 'GET' }),
        catch: refreshCause => operationError(refreshCause)
      }).pipe(Effect.flatMap(() => sendRequest(connection, apexCode)))
    ),
    Effect.catchTag('InvalidSessionError', error =>
      Effect.fail(operationError(error.message, messages.authForAnonymousApexFailed))
    ),
    Effect.catchTag('ApexRequestError', error =>
      Effect.fail(
        operationError(
          error.message,
          messages.unexpectedExecuteCommandError.replace('%s', () => error.message)
        )
      )
    ),
    Effect.flatMap(parseResponse),
    Effect.flatMap(refineExecutionResult)
  );
});
