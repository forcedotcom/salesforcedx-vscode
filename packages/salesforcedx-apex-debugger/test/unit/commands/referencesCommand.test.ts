/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import { ReferencesCommand } from '../../../src/commands';

describe('References command', () => {
  let sendRequestSpy: sinon.SinonStub;
  let frameCommand: ReferencesCommand;

  beforeEach(() => {
    frameCommand = new ReferencesCommand(
      'https://www.salesforce.com',
      '123',
      '07cFAKE'
    );
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('Should build request', async () => {
    sendRequestSpy = sinon
      .stub(ReferencesCommand.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/references/07cFAKE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth 123`
      }
    };

    await frameCommand.execute();

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });
});
