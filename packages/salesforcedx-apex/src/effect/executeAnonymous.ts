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
import { action, soapBody, soapEnv, soapHeader } from '../execute/types';
import { encodeBody } from '../execute/utils';
import { messages } from '../i18n/i18n';
import { ApexOperationError, ApexResponseDecodeError, causeMessage } from './errors';

const operation = 'executeAnonymous';
class ApexRequestError extends Schema.TaggedError<ApexRequestError>()('ApexRequestError', {
  message: Schema.String,
  invalidSession: Schema.Boolean
}) {}

/** Apex source selected by the caller; file and terminal input belong to the host. */
export const ExecuteAnonymousOptionsSchema = Schema.Struct({ apexCode: Schema.String }).annotations({
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
const ExecutionResultSchema = Schema.Union(
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(false), success: Schema.Literal(false) }),
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(true), success: Schema.Literal(false) }),
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(true), success: Schema.Literal(true) })
);
export const ExecuteAnonymousResultSchema = ExecutionResultSchema.pipe(
  Schema.extend(Schema.Struct({ logBody: Schema.String }))
).annotations({ identifier: 'ExecuteAnonymousResult' });
export type ExecuteAnonymousResult = typeof ExecuteAnonymousResultSchema.Type;

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

const isInvalidSession = (cause: unknown): boolean =>
  typeof cause === 'object' &&
  cause !== null &&
  'name' in cause &&
  cause.name === 'ERROR_HTTP_500' &&
  'message' in cause &&
  typeof cause.message === 'string' &&
  cause.message.includes('INVALID_SESSION_ID');

const parseResponse = (response: unknown) =>
  Schema.decodeUnknown(SoapResponseSchema)(response).pipe(
    Effect.flatMap(({ [soapEnv]: envelope }) =>
      Schema.decodeUnknown(ExecutionResultSchema)(envelope[soapBody].executeAnonymousResponse.result).pipe(
        // Keep absent and empty logs distinct for the class/CLI response contract.
        Effect.map(result => ({ ...result, logBody: envelope[soapHeader]?.DebuggingInfo?.debugLog }))
      )
    ),
    Effect.mapError(
      cause =>
        new ApexResponseDecodeError({
          operation,
          message: 'Invalid execute anonymous SOAP response',
          cause: causeMessage(cause)
        })
    )
  );

const sendRequest = (connection: Connection, code: string) =>
  Effect.tryPromise({
    try: () => connection.request<unknown>(buildRequest(connection, code)),
    catch: cause => new ApexRequestError({ message: causeMessage(cause), invalidSession: isInvalidSession(cause) })
  });

/** Shared execution for the Effect and class response adapters. Not a package export. */
export const executeAnonymousSoap = Effect.fn('Apex.executeAnonymous')(function* (
  connection: Connection,
  options: ExecuteAnonymousOptions
) {
  const { apexCode } = yield* Schema.decodeUnknown(ExecuteAnonymousOptionsSchema)(options).pipe(
    Effect.mapError(cause => operationError(cause, messages.optionExecAnonError))
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
    Effect.catchTags({
      ApexOperationError: error => Effect.fail(error),
      ApexRequestError: error =>
        Effect.fail(
          operationError(
            error.message,
            error.invalidSession
              ? messages.authForAnonymousApexFailed
              : messages.unexpectedExecuteCommandError.replace('%s', () => error.message)
          )
        )
    }),
    Effect.flatMap(parseResponse)
  );
});

/** Executes anonymous Apex with the connection selected by the caller. */
export const executeAnonymous = (connection: Connection, options: ExecuteAnonymousOptions) =>
  executeAnonymousSoap(connection, options).pipe(Effect.map(result => ({ ...result, logBody: result.logBody ?? '' })));
