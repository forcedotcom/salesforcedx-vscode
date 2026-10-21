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

const makeConnection = (request: VitestMock): Connection =>
  ({
    accessToken: '00D-org!token',
    instanceUrl: 'https://example.my.salesforce.com',
    version: '65.0',
    request,
    baseUrl: () => 'https://example.my.salesforce.com/services/data/v65.0'
  }) as unknown as Connection;

describe('executeAnonymous', () => {
  it('uses the caller supplied connection and returns execution details', async () => {
    const request = vi.fn().mockResolvedValue(response);
    const connection = makeConnection(request);

    await expect(Effect.runPromise(executeAnonymous(connection, { apexCode: 'System.debug(1);' }))).resolves.toEqual({
      compiled: true,
      success: true,
      line: -1,
      column: -1,
      compileProblem: '',
      exceptionMessage: '',
      exceptionStackTrace: '',
      logBody: ''
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://example.my.salesforce.com/services/Soap/s/65.0/00D-org',
        body: expect.stringContaining('System.debug(1);')
      })
    );
  });

  it('reports request failures through the typed error channel', async () => {
    const connection = makeConnection(vi.fn().mockRejectedValue(new Error('request failed')));

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymous(connection, { apexCode: 'System.debug(1);' })))
    ).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      operation: 'executeAnonymous',
      cause: 'request failed'
    });
  });

  it('rebuilds the SOAP request after refreshing an expired session', async () => {
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

    await expect(
      Effect.runPromise(executeAnonymous(connection, { apexCode: 'System.debug(1);' }))
    ).resolves.toMatchObject({ compiled: true, success: true });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[1][0]).toEqual({ url: connection.baseUrl(), method: 'GET' });
    expect(request.mock.calls[0][0].body).toContain('00D-org!token');
    expect(request.mock.calls[2][0].body).toContain('00D-org!new-token');
    expect(request.mock.calls[2][0].body).not.toContain('<cmd:sessionId>00D-org!token</cmd:sessionId>');
  });

  it('retries an expired session only once', async () => {
    const expired = new Error('INVALID_SESSION_ID');
    expired.name = 'ERROR_HTTP_500';
    const request = vi.fn().mockRejectedValueOnce(expired).mockResolvedValueOnce({}).mockRejectedValueOnce(expired);

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymous(makeConnection(request), { apexCode: 'System.debug(1);' })))
    ).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      message: 'The authentication for execute anonymous failed'
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('rejects inconsistent success and compilation flags', async () => {
    const inconsistent = structuredClone(response);
    inconsistent['soapenv:Envelope']['soapenv:Body'].executeAnonymousResponse.result.compiled = 'false';

    await expect(
      Effect.runPromise(
        Effect.flip(executeAnonymous(makeConnection(vi.fn().mockResolvedValue(inconsistent)), { apexCode: 'bad apex' }))
      )
    ).resolves.toMatchObject({ _tag: 'ApexResponseDecodeError' });
  });

  it('reports malformed responses through the decode error channel', async () => {
    const connection = makeConnection(vi.fn().mockResolvedValue({}));

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymous(connection, { apexCode: 'System.debug(1);' })))
    ).resolves.toMatchObject({ _tag: 'ApexResponseDecodeError', operation: 'executeAnonymous' });
  });

  it.each([
    { compiled: 'not a boolean' },
    { success: 'not a boolean' },
    { line: 'not a number' },
    { line: undefined },
    { column: 1.5 },
    { compileProblem: { unexpected: 'object' } },
    { exceptionMessage: 42 }
  ])('rejects malformed SOAP fields: %j', async fields => {
    const malformed = structuredClone(response);
    Object.assign(malformed['soapenv:Envelope']['soapenv:Body'].executeAnonymousResponse.result, fields);
    const request = vi.fn().mockResolvedValue(malformed);

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymous(makeConnection(request), { apexCode: 'System.debug(1);' })))
    ).resolves.toMatchObject({ _tag: 'ApexResponseDecodeError' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('decodes SOAP numeric text and nil diagnostic fields without host objects', async () => {
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

    await expect(
      Effect.runPromise(executeAnonymous(makeConnection(request), { apexCode: 'bad apex' }))
    ).resolves.toEqual({
      compiled: false,
      success: false,
      line: 3,
      column: 12,
      compileProblem: 'Unexpected token',
      exceptionMessage: null,
      exceptionStackTrace: null,
      logBody: 'LOG'
    });
  });

  it('decodes the XML representation returned by generic Connection.request', async () => {
    const soapResponse = await parseStringPromise(
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <soapenv:Header><DebuggingInfo><debugLog>LOG &amp; TEXT</debugLog></DebuggingInfo></soapenv:Header>
        <soapenv:Body><executeAnonymousResponse><result>
          <compiled>false</compiled><success>false</success><line>3</line><column>12</column>
          <compileProblem>Unexpected token</compileProblem><exceptionMessage xsi:nil="true"/>
          <exceptionStackTrace xsi:nil="true"/>
        </result></executeAnonymousResponse></soapenv:Body>
      </soapenv:Envelope>`,
      { explicitArray: false }
    );

    await expect(
      Effect.runPromise(
        executeAnonymous(makeConnection(vi.fn().mockResolvedValue(soapResponse)), { apexCode: 'bad apex' })
      )
    ).resolves.toEqual({
      compiled: false,
      success: false,
      line: 3,
      column: 12,
      compileProblem: 'Unexpected token',
      exceptionMessage: null,
      exceptionStackTrace: null,
      logBody: 'LOG & TEXT'
    });
  });

  it('returns runtime diagnostics as data, not an operation failure', async () => {
    const runtimeFailure = structuredClone(response);
    Object.assign(runtimeFailure['soapenv:Envelope']['soapenv:Body'].executeAnonymousResponse.result, {
      success: 'false',
      exceptionMessage: 'System.AssertException: Assertion Failed',
      exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
    });

    await expect(
      Effect.runPromise(
        executeAnonymous(makeConnection(vi.fn().mockResolvedValue(runtimeFailure)), { apexCode: 'code' })
      )
    ).resolves.toMatchObject({
      compiled: true,
      success: false,
      exceptionMessage: 'System.AssertException: Assertion Failed',
      exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
    });
  });

  it('validates source content before issuing a request', async () => {
    const request = vi.fn();

    await expect(
      Effect.runPromise(
        Effect.flip(executeAnonymous(makeConnection(request), { apexCode: 42 } as unknown as { apexCode: string }))
      )
    ).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      operation: 'executeAnonymous',
      message: 'Please specify an option to execute anonymous Apex.'
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each(['ERROR_HTTP_500', 'ERROR_HTTP_400'])('does not retry an unrelated %s failure', async name => {
    const error = new Error('unrelated fault');
    error.name = name;
    const request = vi.fn().mockRejectedValue(error);

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymous(makeConnection(request), { apexCode: 'code' })))
    ).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      message: 'Unexpected error while executing anonymous apex. unrelated fault'
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops when refreshing authentication fails', async () => {
    const expired = new Error('INVALID_SESSION_ID');
    expired.name = 'ERROR_HTTP_500';
    const request = vi.fn().mockRejectedValueOnce(expired).mockRejectedValueOnce(new Error('refresh failed'));

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymous(makeConnection(request), { apexCode: 'code' })))
    ).resolves.toMatchObject({ _tag: 'ApexOperationError', message: 'refresh failed' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('escapes source and session content and requests the existing debugging categories', async () => {
    const request = vi.fn().mockResolvedValue(response);
    const connection = makeConnection(request);
    connection.accessToken = '00D-org!token&<';

    await Effect.runPromise(executeAnonymous(connection, { apexCode: "System.debug('<&>\"');" }));

    const body = request.mock.calls[0][0].body;
    expect(body).toContain('<cmd:sessionId>00D-org!token&amp;&lt;</cmd:sessionId>');
    expect(body).toContain('System.debug(&apos;&lt;&amp;&gt;&quot;&apos;);');
    expect(body).toContain('<apex:category>Apex_code</apex:category><apex:level>Finest</apex:level>');
    expect(body).toContain('<apex:category>Visualforce</apex:category><apex:level>Finer</apex:level>');
    expect(body).toContain('<apex:category>Apex_profiling</apex:category><apex:level>Info</apex:level>');
  });
});
