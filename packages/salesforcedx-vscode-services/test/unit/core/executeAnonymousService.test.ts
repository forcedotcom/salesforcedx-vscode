/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import type { Mock as VitestMock } from 'vitest';
import * as Effect from 'effect/Effect';
import { executeAnonymousWithConnection } from '../../../src/core/executeAnonymousService';

const makeConnection = (request: VitestMock, accessToken = '00Dxx!APItoken'): Connection =>
  ({
    accessToken,
    instanceUrl: 'https://myorg.my.salesforce.com',
    version: '59.0',
    request,
    baseUrl: () => 'https://myorg.my.salesforce.com/services/data/v59.0'
  }) as unknown as Connection;

const soapResponse = (result: Record<string, unknown>, logBody?: string) => ({
  'soapenv:Envelope': {
    ...(logBody === undefined ? {} : { 'soapenv:Header': { DebuggingInfo: { debugLog: logBody } } }),
    'soapenv:Body': { executeAnonymousResponse: { result } }
  }
});

describe('executeAnonymousWithConnection', () => {
  it('uses apex-node and preserves the services result and log contract', async () => {
    const request = vi.fn().mockResolvedValue(
      soapResponse(
        {
          column: -1,
          compiled: 'true',
          compileProblem: '',
          exceptionMessage: '',
          exceptionStackTrace: '',
          line: -1,
          success: 'true'
        },
        'LOG BODY HERE'
      )
    );

    await expect(
      Effect.runPromise(executeAnonymousWithConnection(makeConnection(request), 'System.debug(1);'))
    ).resolves.toEqual({
      result: {
        compiled: true,
        success: true
      },
      logBody: 'LOG BODY HERE',
      logId: undefined
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://myorg.my.salesforce.com/services/Soap/s/59.0/00Dxx',
        body: expect.stringContaining('System.debug(1);')
      })
    );
  });

  it('preserves compilation errors and empty XML fields', async () => {
    const request = vi.fn().mockResolvedValue(
      soapResponse({
        column: 12,
        compiled: 'false',
        compileProblem: 'Unexpected token',
        exceptionMessage: {},
        exceptionStackTrace: {},
        line: 3,
        success: 'false'
      })
    );

    await expect(
      Effect.runPromise(executeAnonymousWithConnection(makeConnection(request), 'bad apex'))
    ).resolves.toEqual({
      result: {
        compiled: false,
        success: false,
        line: 3,
        column: 12,
        compileProblem: 'Unexpected token'
      },
      logBody: '',
      logId: undefined
    });
  });

  it('preserves runtime diagnostics for the editor result contract', async () => {
    const request = vi.fn().mockResolvedValue(
      soapResponse(
        {
          column: 1,
          compiled: 'true',
          compileProblem: '',
          exceptionMessage: 'System.AssertException: Assertion Failed',
          exceptionStackTrace: 'AnonymousBlock: line 1, column 1',
          line: 6,
          success: 'false'
        },
        'RUNTIME LOG'
      )
    );

    await expect(
      Effect.runPromise(executeAnonymousWithConnection(makeConnection(request), 'System.assert(false);'))
    ).resolves.toEqual({
      result: {
        compiled: true,
        success: false,
        line: 6,
        column: 1,
        exceptionMessage: 'System.AssertException: Assertion Failed',
        exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
      },
      logBody: 'RUNTIME LOG',
      logId: undefined
    });
  });

  it('rejects a connection without an access token before making a request', async () => {
    const request = vi.fn();

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymousWithConnection(makeConnection(request, ''), 'System.debug(1);')))
    ).resolves.toMatchObject({
      _tag: 'ExecuteAnonymousError',
      message: 'Execute anonymous failed: no access token'
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('maps malformed responses to the services error type', async () => {
    const request = vi.fn().mockResolvedValue({});

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymousWithConnection(makeConnection(request), 'System.debug(1);')))
    ).resolves.toMatchObject({
      _tag: 'ExecuteAnonymousError',
      message: 'Invalid execute anonymous SOAP response'
    });
  });
});
