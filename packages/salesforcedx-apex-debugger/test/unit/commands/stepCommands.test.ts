/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import {
  StepIntoCommand,
  StepOutCommand,
  StepOverCommand
} from '../../../src/commands';

describe('Step commands', () => {
  let sendRequestSpy: sinon.SinonStub;

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('Step Into command should have proper request url', async () => {
    const command = new StepIntoCommand(
      'https://www.salesforce.com',
      '123',
      '07cFAKE'
    );
    sendRequestSpy = sinon
      .stub(StepIntoCommand.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=into',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth 123`
      }
    };

    await command.execute();

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });

  it('Step Out command should have proper request url', async () => {
    const command = new StepOutCommand(
      'https://www.salesforce.com',
      '123',
      '07cFAKE'
    );
    sendRequestSpy = sinon
      .stub(StepOutCommand.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=out',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth 123`
      }
    };

    await command.execute();

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });

  it('Step Over command should have proper request url', async () => {
    const command = new StepOverCommand(
      'https://www.salesforce.com',
      '123',
      '07cFAKE'
    );
    sendRequestSpy = sinon
      .stub(StepOverCommand.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/step/07cFAKE?type=into',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth 123`
      }
    };

    await command.execute();

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });
});
