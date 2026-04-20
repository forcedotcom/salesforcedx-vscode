/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { XHROptions, XHRResponse } from 'request-light';
import { FrameCommand } from '../../../src/commands';
import { DEFAULT_CONNECTION_TIMEOUT_MS } from '../../../src/constants';
import { RequestService } from '../../../src/requestService/requestService';
import { getDefaultHeaders } from './baseDebuggerCommand.test';

describe('Frame command', () => {
  let sendRequestSpy: jest.SpyInstance;
  let frameCommand: FrameCommand;
  const requestService = new RequestService();

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
    frameCommand = new FrameCommand('07cFAKE', 1);
  });

  it('Should build request', async () => {
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/frame/07cFAKE?stackFrame=1',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(frameCommand);

    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
  });
});
