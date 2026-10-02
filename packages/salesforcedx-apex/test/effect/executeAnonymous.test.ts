/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { executeAnonymous } from '../../src/effect';
import type { SoapResponse } from '../../src/execute/types';

const response: SoapResponse = {
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

const makeConnection = (request: jest.Mock): Connection =>
  ({
    accessToken: '00D-org!token',
    instanceUrl: 'https://example.my.salesforce.com',
    version: '65.0',
    request,
    baseUrl: () => 'https://example.my.salesforce.com/services/data/v65.0'
  }) as unknown as Connection;

describe('executeAnonymous', () => {
  it('uses the caller supplied connection and returns execution details', async () => {
    const request = jest.fn().mockResolvedValue(response);
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
    const connection = makeConnection(jest.fn().mockRejectedValue(new Error('request failed')));

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymous(connection, { apexCode: 'System.debug(1);' })))
    ).resolves.toMatchObject({
      _tag: 'ApexOperationError',
      operation: 'executeAnonymous',
      cause: 'request failed'
    });
  });

  it('rebuilds the SOAP request after refreshing an expired session', async () => {
    const request = jest.fn();
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
    expect(request.mock.calls[2][0].body).toContain('00D-org!new-token');
  });

  it('reports malformed responses through the decode error channel', async () => {
    const connection = makeConnection(jest.fn().mockResolvedValue({}));

    await expect(
      Effect.runPromise(Effect.flip(executeAnonymous(connection, { apexCode: 'System.debug(1);' })))
    ).resolves.toMatchObject({ _tag: 'ApexResponseDecodeError', operation: 'executeAnonymous' });
  });
});
