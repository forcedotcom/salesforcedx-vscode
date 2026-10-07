/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { HttpRequest } from '@jsforce/jsforce-node';
import type { Connection } from '@salesforce/core';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { type SoapResponse, action, soapBody, soapEnv, soapHeader } from '../execute/types';
import { encodeBody } from '../execute/utils';
import { ApexOperationError, ApexResponseDecodeError, causeMessage } from './errors';

const operation = 'executeAnonymous';
const AUTH_FAILURE_MESSAGE = 'Authentication for anonymous Apex failed';
class ApexRequestError extends Data.TaggedError('ApexRequestError')<{ cause: unknown }> {}

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
  exceptionStackTrace: Schema.NullOr(Schema.String),
  logBody: Schema.String
};
export const ExecuteAnonymousResultSchema = Schema.Union(
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(false), success: Schema.Literal(false) }),
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(true), success: Schema.Literal(false) }),
  Schema.Struct({ ...resultFields, compiled: Schema.Literal(true), success: Schema.Literal(true) })
).annotations({ identifier: 'ExecuteAnonymousResult' });
export type ExecuteAnonymousResult = typeof ExecuteAnonymousResultSchema.Type;

const operationError = (cause: unknown, message = causeMessage(cause)): ApexOperationError =>
  new ApexOperationError({ operation, message, cause: causeMessage(cause) });

const buildRequest = (connection: Connection, code: string): HttpRequest => {
  const accessToken = connection.accessToken ?? '';
  return {
    method: 'POST',
    url: `${connection.instanceUrl}/services/Soap/s/${connection.version}/${accessToken.split('!')[0]}`,
    body: encodeBody(accessToken, code),
    headers: { 'content-type': 'text/xml', soapaction: action }
  };
};

const textOrNull = (value: string | object | undefined): string | null => (typeof value === 'string' ? value : null);
const lineOrDefault = (value: number | undefined): number => (Number.isFinite(Number(value)) ? Number(value) : 1);
const isInvalidSession = (cause: unknown): boolean =>
  typeof cause === 'object' &&
  cause !== null &&
  'name' in cause &&
  cause.name === 'ERROR_HTTP_500' &&
  'message' in cause &&
  typeof cause.message === 'string' &&
  cause.message.includes('INVALID_SESSION_ID');
const isInvalidSessionRequestError = (error: ApexRequestError | ApexOperationError): boolean =>
  error instanceof ApexRequestError && isInvalidSession(error.cause);

const parseResponse = (response: SoapResponse): Effect.Effect<ExecuteAnonymousResult, ApexResponseDecodeError> =>
  Effect.try({
    try: () => {
      const envelope = response[soapEnv];
      if (!envelope) throw new Error('Missing SOAP envelope');
      const result = envelope[soapBody].executeAnonymousResponse.result;
      const debugLog = envelope[soapHeader]?.DebuggingInfo?.debugLog;
      const formatted = {
        compiled: result.compiled === 'true',
        success: result.success === 'true',
        line: lineOrDefault(result.line),
        column: lineOrDefault(result.column),
        compileProblem: textOrNull(result.compileProblem),
        exceptionMessage: textOrNull(result.exceptionMessage),
        exceptionStackTrace: textOrNull(result.exceptionStackTrace),
        logBody: typeof debugLog === 'string' ? debugLog : ''
      };
      return Schema.decodeUnknownSync(ExecuteAnonymousResultSchema)(formatted);
    },
    catch: cause =>
      new ApexResponseDecodeError({
        operation,
        message: 'Invalid execute anonymous SOAP response',
        cause: causeMessage(cause)
      })
  });

/** Executes anonymous Apex with the connection selected by the caller. */
export const executeAnonymous = Effect.fn('Apex.executeAnonymous')(function* (
  connection: Connection,
  options: ExecuteAnonymousOptions
) {
  const response = yield* Effect.tryPromise({
    try: () => connection.request<SoapResponse>(buildRequest(connection, options.apexCode)),
    catch: cause => new ApexRequestError({ cause })
  }).pipe(
    Effect.tapError(error =>
      isInvalidSessionRequestError(error)
        ? Effect.tryPromise({
            try: () => connection.request({ url: connection.baseUrl(), method: 'GET' }),
            catch: refreshCause => operationError(refreshCause)
          })
        : Effect.void
    ),
    Effect.retry({ times: 1, while: isInvalidSessionRequestError }),
    Effect.mapError(error =>
      error instanceof ApexOperationError
        ? error
        : isInvalidSession(error.cause)
          ? operationError(error.cause, AUTH_FAILURE_MESSAGE)
          : operationError(error.cause, `Unexpected error executing anonymous Apex: ${causeMessage(error.cause)}`)
    )
  );
  return yield* parseResponse(response);
});
