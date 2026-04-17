/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { XHROptions, XHRResponse } from 'request-light';
import { ReferencesCommand } from '../../../src/commands';
import { DEFAULT_CONNECTION_TIMEOUT_MS } from '../../../src/constants';
import { RequestService } from '../../../src/requestService/requestService';
import { getDefaultHeaders } from './baseDebuggerCommand.test';

describe('References command', () => {
  let sendRequestSpy: jest.SpyInstance;
  let referencesCommand: ReferencesCommand;
  const requestService = new RequestService();

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
    referencesCommand = new ReferencesCommand('07cFAKE');
  });

  it('Should build request', async () => {
    sendRequestSpy = jest
      .spyOn(RequestService.prototype, 'sendRequest')
      .mockResolvedValue({ status: 200, responseText: '' } as XHRResponse);
    const requestBody = JSON.stringify({
      getReferencesRequest: {
        reference: []
      }
    });
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/references/07cFAKE',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(Buffer.byteLength(requestBody, 'utf-8')),
      data: requestBody
    };

    await requestService.execute(referencesCommand);

    expect(sendRequestSpy).toHaveBeenCalledTimes(1);
    expect(sendRequestSpy).toHaveBeenCalledWith(expectedOptions);
  });
});
