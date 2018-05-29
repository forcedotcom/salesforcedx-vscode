/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  RequestService,
  RestHttpMethodEnum
} from '@salesforce/salesforcedx-apex-replay-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import {
  QueryExistingOverlayActionIdsCommand,
  QueryOverlayActionIdsSuccessResult
} from '../../../src/commands/queryExistingOverlayActionIdsCommand';
import { createExpectedXHROptions } from './apexExecutionOverlayActionCommand.test';

describe('QueryExistingOverlayActionIdsCommand command', () => {
  let sendRequestSpy: sinon.SinonStub;
  let queryOverlayActionCommand: QueryExistingOverlayActionIdsCommand;
  const requestService = new RequestService();
  const userId = '005xx000001UcFFAKE';
  const expectedGetUrl =
    "https://www.salesforce.com/services/data/v43.0/tooling/query?q=SELECT Id FROM ApexExecutionOverlayAction WHERE ScopeId='" +
    userId +
    "'";
  const responseSuccessEmpty =
    '{"size":0,"totalSize":0,"done":true,"queryLocator":null,"entityTypeName":null,"records":[]}';
  const responseSuccessFiveActions =
    '{"size":5,"totalSize":5,"done":true,"queryLocator":null,"entityTypeName":"ApexExecutionOverlayAction","records":[{"attributes":{"type":"ApexExecutionOverlayAction","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000000TgAAI"},"Id":"1doxx00000000TgAAI"},{"attributes":{"type":"ApexExecutionOverlayAction","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000000TuAAI"},"Id":"1doxx00000000TuAAI"},{"attributes":{"type":"ApexExecutionOverlayAction","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000000TlAAI"},"Id":"1doxx00000000TlAAI"},{"attributes":{"type":"ApexExecutionOverlayAction","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000000TzAAI"},"Id":"1doxx00000000TzAAI"},{"attributes":{"type":"ApexExecutionOverlayAction","url":"/services/data/v44.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000000U0AAI"},"Id":"1doxx00000000U0AAI"}]}';

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('QueryExistingOverlayActionIdsCommand GET REST call with parse-able success result, no action objects', async () => {
    queryOverlayActionCommand = new QueryExistingOverlayActionIdsCommand(
      userId
    );
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: responseSuccessEmpty
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Post
    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined, // there is no request body for this command
      expectedGetUrl,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      queryOverlayActionCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    // parse the returnString and verify the size is 0 and the records list is empty
    const response = JSON.parse(
      returnString
    ) as QueryOverlayActionIdsSuccessResult;
    expect(response.size).to.equal(0);
    expect(response.records.length).to.equal(0);
  });
  it('QueryExistingOverlayActionIdsCommand GET REST call with parse-able success result, 5 action objects', async () => {
    queryOverlayActionCommand = new QueryExistingOverlayActionIdsCommand(
      userId
    );
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: responseSuccessFiveActions
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Post
    const expectedOptions: XHROptions = createExpectedXHROptions(
      undefined, // there is no request body for this command
      expectedGetUrl,
      RestHttpMethodEnum.Get
    );

    const returnString = await requestService.execute(
      queryOverlayActionCommand,
      RestHttpMethodEnum.Get
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    // parse the returnString and verify the size is 5 and there are 5 records in the list
    const response = JSON.parse(
      returnString
    ) as QueryOverlayActionIdsSuccessResult;
    expect(response.size).to.equal(5);
    expect(response.records.length).to.equal(5);
  });
});
