/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import { HeartbeatCommand, RequestService } from '../../../src/commands';
import { DEFAULT_CONNECTION_TIMEOUT_MS } from '../../../src/constants';
import { getDefaultHeaders } from './baseCommand.test';

describe('Heartbeat command', () => {
  let sendRequestSpy: sinon.SinonStub;
  let heartbeatCommand: HeartbeatCommand;
  const requestService = new RequestService();

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
    heartbeatCommand = new HeartbeatCommand('07aFAKE');
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('Should build request', async () => {
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/heartbeat/07aFAKE',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(heartbeatCommand);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });
});
