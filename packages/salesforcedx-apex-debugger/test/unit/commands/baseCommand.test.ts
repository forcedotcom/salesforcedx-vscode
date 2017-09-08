/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import { BaseCommand } from '../../../src/commands/baseCommand';

class DummyCommand extends BaseCommand {
  public constructor(
    commandName: string,
    instanceUrl: string,
    accessToken: string,
    debuggedRequestId: string,
    queryString?: string
  ) {
    super(
      commandName,
      instanceUrl,
      accessToken,
      debuggedRequestId,
      queryString
    );
  }
}

describe('Base command', () => {
  let sendRequestSpy: sinon.SinonStub;
  let dummyCommand: DummyCommand;

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('Should build request without query string', async () => {
    dummyCommand = new DummyCommand(
      'dummy',
      'https://www.salesforce.com',
      '123',
      '07cFAKE'
    );
    sendRequestSpy = sinon
      .stub(BaseCommand.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/dummy/07cFAKE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth 123`
      }
    };

    await dummyCommand.execute();

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });

  it('Should build request with query string', async () => {
    dummyCommand = new DummyCommand(
      'dummy2',
      'https://www.salesforce.com',
      '123',
      '07cFAKE',
      'param=whoops'
    );
    sendRequestSpy = sinon
      .stub(BaseCommand.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/dummy2/07cFAKE?param=whoops',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `OAuth 123`
      }
    };

    await dummyCommand.execute();

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });

  it('Should handle command error', async () => {
    dummyCommand = new DummyCommand(
      'dummy',
      'https://www.salesforce.com',
      '123',
      '07cFAKE'
    );
    sendRequestSpy = sinon.stub(BaseCommand.prototype, 'sendRequest').returns(
      Promise.reject({
        status: 500,
        responseText: '{"message":"There was an error", "action":"Try again"}'
      } as XHRResponse)
    );

    try {
      await dummyCommand.execute();
    } catch (error) {
      expect(error).to.equal(
        '{"message":"There was an error", "action":"Try again"}'
      );
    }
  });
});
