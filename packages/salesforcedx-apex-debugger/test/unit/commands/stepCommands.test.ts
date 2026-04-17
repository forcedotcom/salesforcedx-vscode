/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { XHROptions, XHRResponse } from 'request-light';
import { StepIntoCommand, StepOutCommand, StepOverCommand } from '../../../src/commands';
import { DEFAULT_CONNECTION_TIMEOUT_MS } from '../../../src/constants';
import { RequestService } from '../../../src/requestService/requestService';
import { getDefaultHeaders } from './baseDebuggerCommand.test';

describe('Step commands', () => {
  let sendRequestSpy: jest.SpyInstance;
  const requestService = new RequestService();

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  it('Step Into command should have proper request url', async () => {
    const command = new StepIntoCommand('07cFAKE');
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=into',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(command);

    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
  });

  it('Step Out command should have proper request url', async () => {
    const command = new StepOutCommand('07cFAKE');
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=out',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(command);

    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
  });

  it('Step Over command should have proper request url', async () => {
    const command = new StepOverCommand('07cFAKE');
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=over',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(command);

    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
  });
});
