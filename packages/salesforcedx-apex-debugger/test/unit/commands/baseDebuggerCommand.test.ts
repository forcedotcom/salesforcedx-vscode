/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { XHROptions, XHRResponse } from 'request-light';
import { BaseDebuggerCommand } from '../../../src/commands/baseDebuggerCommand';
import { DebuggerRequest } from '../../../src/commands/protocol';
import { CLIENT_ID, DEFAULT_CONNECTION_TIMEOUT_MS } from '../../../src/constants';
import { RequestService } from '../../../src/requestService/requestService';

class DummyCommand extends BaseDebuggerCommand {}

export const getDefaultHeaders = (contentLength: number): any => ({
  'Content-Type': 'application/json;charset=utf-8',
  Accept: 'application/json',
  Authorization: 'OAuth 123',
  'Content-Length': String(contentLength),
  'Sforce-Call-Options': `client=${CLIENT_ID}`
});

describe('Base command', () => {
  let sendRequestSpy: jest.SpyInstance;
  let dummyCommand: DummyCommand;
  let requestService: RequestService;

  beforeEach(() => {
    requestService = new RequestService();
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  it('Should build request without query string', async () => {
    dummyCommand = new DummyCommand('dummy', '07cFAKE');
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/dummy/07cFAKE',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(dummyCommand);

    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
    expect(dummyCommand.getCommandUrl()).toBe('services/debug/v41.0/dummy/07cFAKE');
  });

  it('Should build request with query string', async () => {
    dummyCommand = new DummyCommand('dummy2', '07cFAKE', 'param=whoops');
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/dummy2/07cFAKE?param=whoops',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(dummyCommand);

    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
    expect(dummyCommand.getQueryString()).toBe('param=whoops');
  });

  it('Should build request with body', async () => {
    const myRequest: DebuggerRequest = {
      getReferencesRequest: {
        reference: []
      }
    };
    dummyCommand = new DummyCommand('dummy2', '07cFAKE', 'param=whoops', myRequest);
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const requestBody = JSON.stringify(myRequest);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/dummy2/07cFAKE?param=whoops',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(Buffer.byteLength(requestBody, 'utf-8')),
      data: requestBody
    };

    await requestService.execute(dummyCommand);

    expect(dummyCommand.getRequest()).toBe(JSON.stringify(myRequest));
    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
  });

  it('Should handle command error', async () => {
    dummyCommand = new DummyCommand('dummy', '07cFAKE');
    jest.spyOn(RequestService.prototype, 'sendRequest').mockRejectedValue({
      status: 500,
      responseText: '{"message":"There was an error", "action":"Try again"}'
    } as XHRResponse);

    await expect(requestService.execute(dummyCommand)).rejects.toBe(
      '{"message":"There was an error", "action":"Try again"}'
    );
  });
});
