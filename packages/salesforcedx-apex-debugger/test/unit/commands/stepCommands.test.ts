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
import {
  StepIntoCommand,
  StepOutCommand,
  StepOverCommand
} from '../../../src/commands';
import { getDefaultHeaders } from './baseDebuggerCommand.test';

describe('Step commands', () => {
  let sendRequestSpy: sinon.SinonStub;
  const requestService = new RequestService();

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('Step Into command should have proper request url', async () => {
    const command = new StepIntoCommand('07cFAKE');
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=into',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(command);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });

  it('Step Out command should have proper request url', async () => {
    const command = new StepOutCommand('07cFAKE');
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=out',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(command);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });

  it('Step Over command should have proper request url', async () => {
    const command = new StepOverCommand('07cFAKE');
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=over',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(command);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });
});
