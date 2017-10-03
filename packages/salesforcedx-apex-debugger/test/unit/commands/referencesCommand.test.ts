/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import { ReferencesCommand, RequestService } from '../../../src/commands';
import { DEFAULT_CONNECTION_TIMEOUT_MS } from '../../../src/constants';

describe('References command', () => {
  let sendRequestSpy: sinon.SinonStub;
  let referencesCommand: ReferencesCommand;
  const requestService = new RequestService();

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
    referencesCommand = new ReferencesCommand('07cFAKE');
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
      url: 'https://www.salesforce.com/services/debug/v41.0/references/07cFAKE',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth 123`
      },
      data: JSON.stringify({
        getReferencesRequest: {
          reference: []
        }
      })
    };

    await requestService.execute(referencesCommand);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });
});
