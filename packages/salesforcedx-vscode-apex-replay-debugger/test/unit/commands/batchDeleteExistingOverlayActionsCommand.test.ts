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
import {
  INVALID_CROSS_REFERENCE_KEY,
  OVERLAY_ACTION_DELETE_URL
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import {
  BatchDeleteExistingOverlayActionCommand,
  BatchDeleteResponse,
  BatchRequest,
  BatchRequests
} from '../../../src/commands/batchDeleteExistingOverlayActionsCommand';
import { createExpectedXHROptions } from './apexExecutionOverlayActionCommand.test';

let sendRequestSpy: sinon.SinonStub;
let batchDeleteCommand: BatchDeleteExistingOverlayActionCommand;
const requestService = new RequestService();
const tempApexExecutionOverlayId = '1doxx00000FAKE';
const expectedBatchUrl =
  'https://www.salesforce.com/services/data/v43.0/tooling/composite/batch';
const requestBody =
  '{"batchRequests":[{"method":"DELETE","url":"services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000FAKE0"},{"method":"DELETE","url":"services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000FAKE1"},{"method":"DELETE","url":"services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000FAKE2"},{"method":"DELETE","url":"services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000FAKE3"},{"method":"DELETE","url":"services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction/1doxx00000FAKE4"}]}';
const responseNoErrors =
  '{"hasErrors": false,"results": [{"statusCode": 204,"result": null},{"statusCode": 204,"result": null},{"statusCode": 204,"result": null},{"statusCode": 204,"result": null},{"statusCode": 204,"result": null}]}';

const responseWithErrors =
  '{"hasErrors":true,"results":[{"statusCode":204,"result":null},{"statusCode":204,"result":null},{"result":[{"errorCode":"INVALID_CROSS_REFERENCE_KEY","message":"invalid cross reference id"}],"statusCode":404},{"statusCode":204,"result":null},{"statusCode":204,"result":null}]}';

beforeEach(() => {
  requestService.instanceUrl = 'https://www.salesforce.com';
  requestService.accessToken = '123';
});

afterEach(() => {
  sendRequestSpy.restore();
});

it('BatchDeleteExistingOverlayActionCommand POST REST call with non-error result', async () => {
  const requests: BatchRequest[] = [];
  for (let i = 0; i < 5; i++) {
    const request: BatchRequest = {
      method: RestHttpMethodEnum.Delete,
      url:
        'services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction/' +
        tempApexExecutionOverlayId +
        i
    };
    requests.push(request);
  }
  const batchRequests: BatchRequests = {
    batchRequests: requests
  };
  batchDeleteCommand = new BatchDeleteExistingOverlayActionCommand(
    batchRequests
  );

  sendRequestSpy = sinon.stub(RequestService.prototype, 'sendRequest').returns(
    Promise.resolve({
      status: 200,
      responseText: responseNoErrors
    } as XHRResponse)
  );

  // The expected options needs to contain the request body, url and RestHttpMethodEnum.Post
  const expectedOptions: XHROptions = createExpectedXHROptions(
    requestBody,
    expectedBatchUrl,
    RestHttpMethodEnum.Post
  );

  const returnString = await requestService.execute(
    batchDeleteCommand,
    RestHttpMethodEnum.Post
  );

  expect(sendRequestSpy.calledOnce).to.equal(true);
  expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

  // Verify the return string
  expect(returnString).to.be.equal(responseNoErrors);

  // parse the returnString and verify the number of results is 5
  const response = JSON.parse(returnString) as BatchDeleteResponse;
  expect(response.hasErrors).to.equal(false);
  expect(response.results.length).to.equal(5);
});

it('BatchDeleteExistingOverlayActionCommand POST REST call with error result', async () => {
  const requests: BatchRequest[] = [];
  for (let i = 0; i < 5; i++) {
    const request: BatchRequest = {
      method: RestHttpMethodEnum.Delete,
      url: OVERLAY_ACTION_DELETE_URL + tempApexExecutionOverlayId + i
    };
    requests.push(request);
  }
  const batchRequests: BatchRequests = {
    batchRequests: requests
  };
  batchDeleteCommand = new BatchDeleteExistingOverlayActionCommand(
    batchRequests
  );

  sendRequestSpy = sinon.stub(RequestService.prototype, 'sendRequest').returns(
    Promise.resolve({
      status: 200,
      responseText: responseWithErrors
    } as XHRResponse)
  );

  // The expected options needs to contain the request body, url and RestHttpMethodEnum.Post
  const expectedOptions: XHROptions = createExpectedXHROptions(
    requestBody,
    expectedBatchUrl,
    RestHttpMethodEnum.Post
  );

  const returnString = await requestService.execute(
    batchDeleteCommand,
    RestHttpMethodEnum.Post
  );

  expect(sendRequestSpy.calledOnce).to.equal(true);
  expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

  // Verify the return string
  expect(returnString).to.be.equal(responseWithErrors);

  // parse the returnString and verify the number of results is 5
  const response = JSON.parse(returnString) as BatchDeleteResponse;
  expect(response.hasErrors).to.equal(true);
  expect(response.results.length).to.equal(5);
  expect(response.results[2].result![0].errorCode).to.be.equal(
    INVALID_CROSS_REFERENCE_KEY
  );
});
