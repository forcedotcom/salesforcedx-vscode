/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { HttpRequest } from '@jsforce/jsforce-node';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';
import { type SoapResponse, action, soapBody, soapEnv, soapHeader } from '../execute/types';
import { encodeBody } from '../execute/utils';
import { ApexOperationError, ApexResponseDecodeError, causeMessage } from './errors';

const operation = 'executeAnonymous';
const AUTH_FAILURE_MESSAGE = 'Authentication for anonymous Apex failed';

/** Apex source selected by the caller; file and terminal input belong to the host. */
export const ExecuteAnonymousOptionsSchema = Schema.Struct({ apexCode: Schema.String }).annotations({
  identifier: 'ExecuteAnonymousOptions'
});
export type ExecuteAnonymousOptions = typeof ExecuteAnonymousOptionsSchema.Type;

/** Execution details and the debug log returned by the Apex SOAP endpoint. */
export const ExecuteAnonymousResultSchema = Schema.Struct({
  compiled: Schema.Boolean,
  compileProblem: Schema.NullOr(Schema.String),
  success: Schema.Boolean,
  line: Schema.Number,
  column: Schema.Number,
  exceptionMessage: Schema.NullOr(Schema.String),
  exceptionStackTrace: Schema.NullOr(Schema.String),
  logBody: Schema.String
}).annotations({ identifier: 'ExecuteAnonymousResult' });
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

const parseResponse = (response: SoapResponse): Effect.Effect<ExecuteAnonymousResult, ApexResponseDecodeError> =>
  Effect.try({
    try: () => {
      const envelope = response[soapEnv];
      if (!envelope) throw new Error('Missing SOAP envelope');
      const result = envelope[soapBody].executeAnonymousResponse.result;
      const debugLog = envelope[soapHeader]?.DebuggingInfo?.debugLog;
      const formatted: ExecuteAnonymousResult = {
        compiled: result.compiled === 'true',
        success: result.success === 'true',
        line: lineOrDefault(result.line),
        column: lineOrDefault(result.column),
        compileProblem: textOrNull(result.compileProblem),
        exceptionMessage: textOrNull(result.exceptionMessage),
        exceptionStackTrace: textOrNull(result.exceptionStackTrace),
        logBody: typeof debugLog === 'string' ? debugLog : ''
      };
      return formatted;
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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const request = buildRequest(connection, options.apexCode);
    const response = yield* Effect.either(
      Effect.tryPromise({ try: () => connection.request<SoapResponse>(request), catch: cause => ({ cause }) })
    );
    if (Either.isRight(response)) return yield* parseResponse(response.right);

    const { cause } = response.left;
    if (
      typeof cause === 'object' &&
      cause !== null &&
      'name' in cause &&
      cause.name === 'ERROR_HTTP_500' &&
      'message' in cause &&
      typeof cause.message === 'string' &&
      cause.message.includes('INVALID_SESSION_ID')
    ) {
      yield* Effect.tryPromise({
        try: () => connection.request({ url: connection.baseUrl(), method: 'GET' }),
        catch: refreshCause => operationError(refreshCause)
      });
      continue;
    }
    return yield* operationError(cause, `Unexpected error executing anonymous Apex: ${causeMessage(cause)}`);
  }

  return yield* operationError(new Error(AUTH_FAILURE_MESSAGE));
});
