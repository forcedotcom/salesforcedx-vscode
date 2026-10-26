/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ExecuteService } from '../../src/execute/executeService';

const makeResponse = (fields = {}, log = 'LOG') => ({
  'soapenv:Envelope': {
    'soapenv:Header': { DebuggingInfo: { debugLog: log } },
    'soapenv:Body': {
      executeAnonymousResponse: {
        result: {
          compiled: 'true',
          success: 'true',
          line: -1,
          column: -1,
          compileProblem: '',
          exceptionMessage: '',
          exceptionStackTrace: '',
          ...fields
        }
      }
    }
  }
});

const makeService = (request: ReturnType<typeof vi.fn>) =>
  new ExecuteService({
    accessToken: '00D-org!token',
    instanceUrl: 'https://example.my.salesforce.com',
    version: '65.0',
    baseUrl: () => 'https://example.my.salesforce.com/services/data/v65.0',
    request
  } as unknown as Connection);

describe('ExecuteService adapter', () => {
  it('accepts Apex source and preserves the CLI success shape', async () => {
    const apexCode = 'System.assert(true);';
    const request = vi.fn().mockResolvedValue(makeResponse());

    await expect(makeService(request).executeAnonymous({ apexCode })).resolves.toEqual({
      compiled: true,
      success: true,
      logs: 'LOG'
    });
    expect(request.mock.calls[0][0].body).toContain(apexCode);
  });

  it('rejects non-string source content before calling Salesforce', async () => {
    const request = vi.fn().mockResolvedValue(makeResponse());
    const options = { apexCode: Buffer.from('System.assert(true);') } as unknown as { apexCode: string };

    await expect(makeService(request).executeAnonymous(options)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it('submits empty source content to Salesforce instead of selecting host input', async () => {
    const request = vi.fn().mockResolvedValue(makeResponse());

    await expect(makeService(request).executeAnonymous({ apexCode: '' })).resolves.toMatchObject({ success: true });
    expect(request.mock.calls[0][0].body).toContain('<apexcode></apexcode>');
  });

  it('preserves compile diagnostics and normalizes SOAP nil fields for the CLI', async () => {
    const request = vi.fn().mockResolvedValue(
      makeResponse(
        {
          compiled: 'false',
          success: 'false',
          line: '6',
          column: '1',
          compileProblem: "Unexpected token '('.",
          exceptionMessage: { $: { 'xsi:nil': 'true' } },
          exceptionStackTrace: {}
        },
        ''
      )
    );

    await expect(makeService(request).executeAnonymous({ apexCode: 'bad apex' })).resolves.toEqual({
      compiled: false,
      success: false,
      logs: '',
      diagnostic: [
        {
          lineNumber: 6,
          columnNumber: 1,
          compileProblem: "Unexpected token '('."
        }
      ]
    });
  });

  it('keeps an absent debug log undefined for CLI JSON output', async () => {
    const { 'soapenv:Header': _header, ...envelope } = makeResponse()['soapenv:Envelope'];
    const request = vi.fn().mockResolvedValue({ 'soapenv:Envelope': envelope });

    await expect(makeService(request).executeAnonymous({ apexCode: 'code' })).resolves.toEqual({
      compiled: true,
      success: true,
      logs: undefined
    });
  });

  it('adapts malformed SOAP failures to plain Promise errors', async () => {
    const request = vi.fn().mockResolvedValue({});

    await expect(makeService(request).executeAnonymous({ apexCode: 'code' })).rejects.toEqual(
      new Error('Invalid execute anonymous SOAP response')
    );
  });

  it('preserves runtime diagnostics for the CLI reporter', async () => {
    const request = vi.fn().mockResolvedValue(
      makeResponse({
        success: 'false',
        line: 6,
        column: 1,
        exceptionMessage: 'System.AssertException: Assertion Failed',
        exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
      })
    );

    await expect(makeService(request).executeAnonymous({ apexCode: 'System.assert(false);' })).resolves.toEqual({
      compiled: true,
      success: false,
      logs: 'LOG',
      diagnostic: [
        {
          lineNumber: 6,
          columnNumber: 1,
          exceptionMessage: 'System.AssertException: Assertion Failed',
          exceptionStackTrace: 'AnonymousBlock: line 1, column 1'
        }
      ]
    });
  });

  it('preserves CLI request error text without an Effect FiberFailure prefix', async () => {
    const request = vi.fn().mockRejectedValue(new Error('request failed'));

    await expect(makeService(request).executeAnonymous({ apexCode: 'code' })).rejects.toEqual(
      new Error('Unexpected error while executing anonymous apex. request failed')
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('uses the primary API authentication retry and preserves CLI auth error text', async () => {
    const expired = new Error('INVALID_SESSION_ID');
    expired.name = 'ERROR_HTTP_500';
    const request = vi.fn().mockRejectedValueOnce(expired).mockResolvedValueOnce({}).mockRejectedValueOnce(expired);

    await expect(makeService(request).executeAnonymous({ apexCode: 'code' })).rejects.toEqual(
      new Error('The authentication for execute anonymous failed')
    );
    expect(request).toHaveBeenCalledTimes(3);
  });
});
