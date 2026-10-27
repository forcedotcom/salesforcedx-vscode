/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import type { Mock as VitestMock } from 'vitest';
import * as Effect from 'effect/Effect';
import { parseStringPromise } from 'xml2js';
import { executeAnonymous } from '../../src/effect';

const response = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      executeAnonymousResponse: {
        result: {
          compiled: 'true',
          success: 'true',
          line: -1,
          column: -1,
          compileProblem: '',
          exceptionMessage: '',
          exceptionStackTrace: ''
        }
      }
    }
  }
};
const responseWithLog = {
  'soapenv:Envelope': {
    ...response['soapenv:Envelope'],
    'soapenv:Header': { DebuggingInfo: { debugLog: 'LOG BODY' } }
  }
};

const makeConnection = (request: VitestMock): Connection =>
  ({
    accessToken: '00D-org!token',
    instanceUrl: 'https://example.my.salesforce.com',
    version: '65.0',
    request,
    baseUrl: () => 'https://example.my.salesforce.com/services/data/v65.0'
  }) as unknown as Connection;

describe('executeAnonymous', () => {
  it('uses the caller supplied connection and returns execution details', () =>
    Effect.gen(function* () {
      const request = vi.fn().mockResolvedValue(response);
      const connection = makeConnection(request);

      expect(yield* executeAnonymous(connection, { apexCode: 'System.debug(1);' })).toEqual({
        compiled: true,
        success: true,
        line: -1,
        column: -1,
        logBody: undefined
      });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://example.my.salesforce.com/services/Soap/s/65.0/00D-org',
          body: expect.stringContaining('System.debug(1);')
        })
      );
    }).pipe(Effect.runPromise));

  it('reports request failures through the typed error channel', () =>
    Effect.gen(function* () {
      const connection = makeConnection(vi.fn().mockRejectedValue(new Error('request failed')));

      expect(yield* executeAnonymous(connection, { apexCode: 'System.debug(1);' }).pipe(Effect.flip)).toMatchObject({
        _tag: 'ApexOperationError',
        operation: 'executeAnonymous',
        cause: 'request failed'
      });
    }).pipe(Effect.runPromise));

  it('rebuilds the SOAP request after refreshing an expired session', () =>
    Effect.gen(function* () {
      const request = vi.fn();
      const connection = makeConnection(request);
      const expired = new Error('INVALID_SESSION_ID');
      expired.name = 'ERROR_HTTP_500';
      request
        .mockRejectedValueOnce(expired)
        .mockImplementationOnce(() => {
          (connection as unknown as { accessToken: string }).accessToken = '00D-org!new-token';
          return Promise.resolve({});
        })
        .mockResolvedValueOnce(response);

      expect(yield* executeAnonymous(connection, { apexCode: 'System.debug(1);' })).toMatchObject({
        compiled: true,
        success: true
      });
      expect(request).toHaveBeenCalledTimes(3);
      expect(request.mock.calls[1][0]).toEqual({ url: connection.baseUrl(), method: 'GET' });
      expect(request.mock.calls[0][0].body).toContain('00D-org!token');
      expect(request.mock.calls[2][0].body).toContain('00D-org!new-token');
      expect(request.mock.calls[2][0].body).not.toContain('<cmd:sessionId>00D-org!token</cmd:sessionId>');
    }).pipe(Effect.runPromise));

  it('retries an expired session only once', () =>
    Effect.gen(function* () {
      const expired = new Error('INVALID_SESSION_ID');
      expired.name = 'ERROR_HTTP_500';
      const request = vi.fn().mockRejectedValueOnce(expired).mockResolvedValueOnce({}).mockRejectedValueOnce(expired);

      expect(
        yield* executeAnonymous(makeConnection(request), { apexCode: 'System.debug(1);' }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: 'ApexOperationError',
        message: 'The authentication for execute anonymous failed'
      });
      expect(request).toHaveBeenCalledTimes(3);
    }).pipe(Effect.runPromise));

  it('rejects inconsistent success and compilation flags', () =>
    Effect.gen(function* () {
      const inconsistent = structuredClone(response);
      inconsistent['soapenv:Envelope']['soapenv:Body'].executeAnonymousResponse.result.compiled = 'false';

      expect(
        yield* executeAnonymous(makeConnection(vi.fn().mockResolvedValue(inconsistent)), { apexCode: 'bad apex' }).pipe(
          Effect.flip
        )
      ).toMatchObject({ _tag: 'ApexResponseDecodeError' });
    }).pipe(Effect.runPromise));

  it('requires the success line and column sentinels returned by Salesforce', () =>
    Effect.gen(function* () {
      const invalidSuccess = structuredClone(response);
      Object.assign(invalidSuccess['soapenv:Envelope']['soapenv:Body'].executeAnonymousResponse.result, {
        line: 1,
        column: 1
      });

      expect(
        yield* executeAnonymous(makeConnection(vi.fn().mockResolvedValue(invalidSuccess)), { apexCode: 'code' }).pipe(
          Effect.flip
        )
      ).toMatchObject({ _tag: 'ApexResponseDecodeError' });
    }).pipe(Effect.runPromise));

  it('returns compilation failures through the typed error channel', () =>
    Effect.gen(function* () {
      const compileFailure = structuredClone(responseWithLog);
      Object.assign(compileFailure['soapenv:Envelope']['soapenv:Body'].executeAnonymousResponse.result, {
        compiled: 'false',
        success: 'false',
        line: 3,
        column: 12,
        compileProblem: 'Unexpected token'
      });

      expect(
        yield* executeAnonymous(makeConnection(vi.fn().mockResolvedValue(compileFailure)), {
          apexCode: 'bad apex'
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: 'ApexCompileError',
        operation: 'executeAnonymous',
        message: 'Unexpected token',
        compileProblem: 'Unexpected token',
        line: 3,
        column: 12,
        logBody: 'LOG BODY'
      });
    }).pipe(Effect.runPromise));

  it('reports malformed responses through the decode error channel', () =>
    Effect.gen(function* () {
      const connection = makeConnection(vi.fn().mockResolvedValue({}));

      expect(yield* executeAnonymous(connection, { apexCode: 'System.debug(1);' }).pipe(Effect.flip)).toMatchObject({
        _tag: 'ApexResponseDecodeError',
        operation: 'executeAnonymous'
      });
    }).pipe(Effect.runPromise));

  it.each([
    { compiled: 'not a boolean' },
    { success: 'not a boolean' },
    { line: 'not a number' },
    { line: undefined },
    { column: 1.5 },
    { compileProblem: { unexpected: 'object' } },
    { exceptionMessage: 42 }
  ])('rejects malformed SOAP fields: %j', fields =>
    Effect.gen(function* () {
      const malformed = structuredClone(response);
      Object.assign(malformed['soapenv:Envelope']['soapenv:Body'].executeAnonymousResponse.result, fields);
      const request = vi.fn().mockResolvedValue(malformed);

      expect(
        yield* executeAnonymous(makeConnection(request), { apexCode: 'System.debug(1);' }).pipe(Effect.flip)
      ).toMatchObject({ _tag: 'ApexResponseDecodeError' });
      expect(request).toHaveBeenCalledTimes(1);
    }).pipe(Effect.runPromise)
  );

  it('decodes SOAP numeric text and nil diagnostic fields without host objects', () =>
    Effect.gen(function* () {
      const request = vi.fn().mockResolvedValue({
        'soapenv:Envelope': {
          'soapenv:Header': { DebuggingInfo: { debugLog: 'LOG' } },
          'soapenv:Body': {
            executeAnonymousResponse: {
              result: {
                compiled: 'false',
                success: 'false',
                line: '3',
                column: '12',
                compileProblem: 'Unexpected token',
                exceptionMessage: { $: { 'xsi:nil': 'true' } },
                exceptionStackTrace: {}
              }
            }
          }
        }
      });

      expect(
        yield* executeAnonymous(makeConnection(request), { apexCode: 'bad apex' }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: 'ApexCompileError',
        compileProblem: 'Unexpected token',
        line: 3,
        column: 12,
        logBody: 'LOG'
      });
    }).pipe(Effect.runPromise));

  it('decodes the XML representation returned by generic Connection.request', () =>
    Effect.gen(function* () {
      const request = vi.fn(() =>
        parseStringPromise(
          `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <soapenv:Header><DebuggingInfo><debugLog>LOG &amp; TEXT</debugLog></DebuggingInfo></soapenv:Header>
        <soapenv:Body><executeAnonymousResponse><result>
          <compiled>false</compiled><success>false</success><line>3</line><column>12</column>
          <compileProblem>Unexpected token</compileProblem><exceptionMessage xsi:nil="true"/>
          <exceptionStackTrace xsi:nil="true"/>
        </result></executeAnonymousResponse></soapenv:Body>
      </soapenv:Envelope>`,
          { explicitArray: false }
        )
      );

      expect(
        yield* executeAnonymous(makeConnection(request), { apexCode: 'bad apex' }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: 'ApexCompileError',
        compileProblem: 'Unexpected token',
        line: 3,
        column: 12,
        logBody: 'LOG & TEXT'
      });
    }).pipe(Effect.runPromise));

  it('returns runtime failures through the typed error channel', () =>
    Effect.gen(function* () {
      const runtimeFailure = structuredClone(response);
      Object.assign(runtimeFailure['soapenv:Envelope']['soapenv:Body'].executeAnonymousResponse.result, {
        success: 'false',
        line: 6,
        column: 1,
        exceptionMessage: 'System.AssertException: Assertion Failed',
        exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
      });

      const error = yield* executeAnonymous(
        makeConnection(vi.fn().mockResolvedValue(runtimeFailure)),
        { apexCode: 'code' }
      ).pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: 'ApexRuntimeError',
        operation: 'executeAnonymous',
        message: 'System.AssertException: Assertion Failed',
        line: 6,
        column: 1,
        exceptionMessage: 'System.AssertException: Assertion Failed',
        exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
      });
      expect(error).not.toHaveProperty('logBody');
    }).pipe(Effect.runPromise));

  it('validates source content before issuing a request', () =>
    Effect.gen(function* () {
      const request = vi.fn();

      expect(
        yield* executeAnonymous(makeConnection(request), { apexCode: 42 } as unknown as { apexCode: string }).pipe(
          Effect.flip
        )
      ).toMatchObject({
        _tag: 'ApexOperationError',
        operation: 'executeAnonymous',
        message: 'Please specify an option to execute anonymous Apex.'
      });
      expect(request).not.toHaveBeenCalled();
    }).pipe(Effect.runPromise));

  it.each(['ERROR_HTTP_500', 'ERROR_HTTP_400'])('does not retry an unrelated %s failure', name =>
    Effect.gen(function* () {
      const error = new Error('unrelated fault');
      error.name = name;
      const request = vi.fn().mockRejectedValue(error);

      expect(yield* executeAnonymous(makeConnection(request), { apexCode: 'code' }).pipe(Effect.flip)).toMatchObject({
        _tag: 'ApexOperationError',
        message: 'Unexpected error while executing anonymous apex. unrelated fault'
      });
      expect(request).toHaveBeenCalledTimes(1);
    }).pipe(Effect.runPromise)
  );

  it('stops when refreshing authentication fails', () =>
    Effect.gen(function* () {
      const expired = new Error('INVALID_SESSION_ID');
      expired.name = 'ERROR_HTTP_500';
      const request = vi.fn().mockRejectedValueOnce(expired).mockRejectedValueOnce(new Error('refresh failed'));

      expect(yield* executeAnonymous(makeConnection(request), { apexCode: 'code' }).pipe(Effect.flip)).toMatchObject({
        _tag: 'ApexOperationError',
        message: 'refresh failed'
      });
      expect(request).toHaveBeenCalledTimes(2);
    }).pipe(Effect.runPromise));

  it('escapes source and session content and requests the existing debugging categories', () =>
    Effect.gen(function* () {
      const request = vi.fn().mockResolvedValue(response);
      const connection = makeConnection(request);
      connection.accessToken = '00D-org!token&<';

      yield* executeAnonymous(connection, { apexCode: "System.debug('<&>\"');" });

      const body = request.mock.calls[0][0].body;
      expect(body).toContain('<cmd:sessionId>00D-org!token&amp;&lt;</cmd:sessionId>');
      expect(body).toContain('System.debug(&apos;&lt;&amp;&gt;&quot;&apos;);');
      expect(body).toContain('<apex:category>Apex_code</apex:category><apex:level>Finest</apex:level>');
      expect(body).toContain('<apex:category>Visualforce</apex:category><apex:level>Finer</apex:level>');
      expect(body).toContain('<apex:category>Apex_profiling</apex:category><apex:level>Info</apex:level>');
    }).pipe(Effect.runPromise));
});
