/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { XHROptions, XHRResponse } from 'request-light';
import { StateCommand } from '../../../src/commands';
import { DEFAULT_CONNECTION_TIMEOUT_MS } from '../../../src/constants';
import { RequestService } from '../../../src/requestService/requestService';
import { getDefaultHeaders } from './baseDebuggerCommand.test';

describe('State command', () => {
  let sendRequestSpy: jest.SpyInstance;
  let stateCommand: StateCommand;
  const requestService = new RequestService();

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
    stateCommand = new StateCommand('07cFAKE');
  });

  it('Should build request', async () => {
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/state/07cFAKE',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(stateCommand);

    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
  });

  it('Should handle run command error', async () => {
    jest.spyOn(RequestService.prototype, 'sendRequest').mockRejectedValue({
      status: 500,
      responseText: '{"message":"There was an error", "action":"Try again"}'
    } as XHRResponse);

    await expect(requestService.execute(stateCommand)).rejects.toBe(
      '{"message":"There was an error", "action":"Try again"}'
    );
  });
});
