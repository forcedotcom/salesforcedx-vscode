/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CLIENT_ID,
  DEFAULT_CONNECTION_TIMEOUT_MS
} from '@salesforce/salesforcedx-utils-vscode/out/src/constants';
import { RequestService } from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import { BaseDebuggerCommand } from '../../../src/commands/baseDebuggerCommand';
import { DebuggerRequest } from '../../../src/commands/protocol';

class DummyCommand extends BaseDebuggerCommand {
  public constructor(
    commandName: string,
    debuggedRequestId: string,
    queryString?: string,
    request?: DebuggerRequest
  ) {
    super(commandName, debuggedRequestId, queryString, request);
  }
}

export function getDefaultHeaders(contentLength: number): any {
  return {
    'Content-Type': 'application/json;charset=utf-8',
    Accept: 'application/json',
    Authorization: `OAuth 123`,
    'Content-Length': contentLength,
    'Sforce-Call-Options': `client=${CLIENT_ID}`
  };
}

describe('Base command', () => {
  let sendRequestSpy: sinon.SinonStub;
  let dummyCommand: DummyCommand;
  let requestService: RequestService;

  beforeEach(() => {
    requestService = new RequestService();
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('Should build request without query string', async () => {
    dummyCommand = new DummyCommand('dummy', '07cFAKE');
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url: 'https://www.salesforce.com/services/debug/v41.0/dummy/07cFAKE',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(dummyCommand);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
    expect(dummyCommand.getCommandUrl()).to.equal(
      'services/debug/v41.0/dummy/07cFAKE'
    );
  });

  it('Should build request with query string', async () => {
    dummyCommand = new DummyCommand('dummy2', '07cFAKE', 'param=whoops');
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/dummy2/07cFAKE?param=whoops',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(0),
      data: undefined
    };

    await requestService.execute(dummyCommand);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
    expect(dummyCommand.getQueryString()).to.equal('param=whoops');
  });

  it('Should build request with body', async () => {
    const myRequest: DebuggerRequest = {
      getReferencesRequest: {
        reference: []
      }
    };
    dummyCommand = new DummyCommand(
      'dummy2',
      '07cFAKE',
      'param=whoops',
      myRequest
    );
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({ status: 200, responseText: '' } as XHRResponse)
      );
    const requestBody = JSON.stringify(myRequest);
    const expectedOptions: XHROptions = {
      type: 'POST',
      url:
        'https://www.salesforce.com/services/debug/v41.0/dummy2/07cFAKE?param=whoops',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
      headers: getDefaultHeaders(Buffer.byteLength(requestBody, 'utf-8')),
      data: requestBody
    };

    await requestService.execute(dummyCommand);

    expect(dummyCommand.getRequest()).to.equal(JSON.stringify(myRequest));
    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });

  it('Should handle command error', async () => {
    dummyCommand = new DummyCommand('dummy', '07cFAKE');
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.reject({
          status: 500,
          responseText: '{"message":"There was an error", "action":"Try again"}'
        } as XHRResponse)
      );

    try {
      await requestService.execute(dummyCommand);
    } catch (error) {
      expect(error).to.equal(
        '{"message":"There was an error", "action":"Try again"}'
      );
    }
  });
});
