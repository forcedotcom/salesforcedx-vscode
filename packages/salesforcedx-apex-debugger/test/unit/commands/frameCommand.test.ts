/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DEFAULT_CONNECTION_TIMEOUT_MS } from '@salesforce/salesforcedx-utils-vscode/out/src/constants';
import { RequestService } from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import { FrameCommand } from '../../../src/commands';
import { getDefaultHeaders } from './baseDebuggerCommand.test';

describe('Frame command', () => {
  let sendRequestSpy: sinon.SinonStub;
  let frameCommand: FrameCommand;
  const requestService = new RequestService();

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
    frameCommand = new FrameCommand('07cFAKE', 1);
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
      url:
        'https://www.salesforce.com/services/debug/v41.0/frame/07cFAKE?stackFrame=1',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(frameCommand);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });
});
