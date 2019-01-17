/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CLIENT_ID,
  DEFAULT_CONNECTION_TIMEOUT_MS
} from '@salesforce/salesforcedx-apex-replay-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/constants';
import {
  RequestService,
  RestHttpMethodEnum
} from '@salesforce/salesforcedx-apex-replay-debugger/node_modules/@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { FIELD_INTEGRITY_EXCEPTION } from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import { expect } from 'chai';
import { XHROptions, XHRResponse } from 'request-light';
import * as sinon from 'sinon';
import {
  ApexExecutionOverlayActionCommand,
  ApexExecutionOverlayFailureResult,
  ApexExecutionOverlaySuccessResult
} from '../../../src/commands/apexExecutionOverlayActionCommand';

// These tests are going to be calling a mocked RequestService. The checkpointService utilizes the
// ApexExecutionOverlayActionCommand under the covers. The presense or absence of an actionObjectId
// is what determines whether or not the action is a post or delete.
describe('ApexExecutionOverlayAction basic class tests', () => {
  let overlayActionCommand: ApexExecutionOverlayActionCommand;
  const requestString =
    "{'ActionScript':'','ActionScriptType':'None','ExecutableEntityName':'MyFakeClassOrTrigger','IsDumpingHeap':true,'Iteration':1,'Line':25}";
  const actionObjectId = '1doxx000000FAKE';

  it('Should should create requestUrl without actionId on the API Path ', async () => {
    overlayActionCommand = new ApexExecutionOverlayActionCommand(requestString);
    expect(overlayActionCommand.getCommandUrl()).to.equal(
      'services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction'
    );
    expect(overlayActionCommand.getQueryString()).to.equal(undefined);
    expect(overlayActionCommand.getRequest()).to.equal(requestString);
  });

  it('Should should create requestUrl with actionId on the API Path ', async () => {
    overlayActionCommand = new ApexExecutionOverlayActionCommand(
      requestString,
      actionObjectId
    );
    expect(overlayActionCommand.getCommandUrl()).to.equal(
      'services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction/' +
        actionObjectId
    );
    expect(overlayActionCommand.getQueryString()).to.equal(undefined);
    expect(overlayActionCommand.getRequest()).to.equal(requestString);
  });
});

// This set of ApexExecutionOverlayActionCommand tests are going to be using the RequestService
describe('ApexExecutionOverlayAction command', () => {
  let sendRequestSpy: sinon.SinonStub;
  let overlayActionCommand: ApexExecutionOverlayActionCommand;

  const actionObjectId = '1doxx000000FAKE';
  const expectedPostUrl =
    'https://www.salesforce.com/services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction';
  const expectedDeleteUrl =
    'https://www.salesforce.com/services/data/v43.0/tooling/sobjects/ApexExecutionOverlayAction/' +
    actionObjectId;
  const requestService = new RequestService();
  const requestString =
    '{"ActionScript":"","ActionScriptType":"None","ExecutableEntityName":"MyFakeClassOrTrigger","IsDumpingHeap":true,"Iteration":1,"Line":25}';
  const reseponseFieldIntegrityError =
    '[{"message":"Some error message, does not really matter, only the error code matters","errorCode":"FIELD_INTEGRITY_EXCEPTION","fields":[]}]';
  const responseSuccess =
    '{"id":"1doxx000000FAKE","success":true,"errors":[],"warnings":[]}';

  beforeEach(() => {
    requestService.instanceUrl = 'https://www.salesforce.com';
    requestService.accessToken = '123';
  });

  afterEach(() => {
    sendRequestSpy.restore();
  });

  it('ApexExecutionOverlayActionCommand POST REST call with parse-able success result', async () => {
    overlayActionCommand = new ApexExecutionOverlayActionCommand(requestString);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: responseSuccess
        } as XHRResponse)
      );

    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Post
    const expectedOptions: XHROptions = createExpectedXHROptions(
      requestString,
      expectedPostUrl,
      RestHttpMethodEnum.Post
    );

    const returnString = await requestService.execute(overlayActionCommand);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    // parse the returnString and verify the ID and success boolean
    const response = JSON.parse(
      returnString
    ) as ApexExecutionOverlaySuccessResult;
    expect(response.id).to.equal(actionObjectId);
    expect(response.success).to.equal(true);
  });

  it('ApexExecutionOverlayActionCommand POST REST call with parse-able FIELD_INTEGRITY_EXCEPTION result', async () => {
    overlayActionCommand = new ApexExecutionOverlayActionCommand(requestString);
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: reseponseFieldIntegrityError
        } as XHRResponse)
      );
    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Post
    const expectedOptions: XHROptions = createExpectedXHROptions(
      requestString,
      expectedPostUrl,
      RestHttpMethodEnum.Post
    );

    const returnString = await requestService.execute(overlayActionCommand);

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);

    // parse the returnString and verify the ID and success boolean
    // note: the return value is an array of ApexExecutionOverlayFailureResult
    const result = JSON.parse(
      returnString
    ) as ApexExecutionOverlayFailureResult[];
    // Verify that the error code can be parses out
    expect(result[0].errorCode).to.equal(FIELD_INTEGRITY_EXCEPTION);
  });

  it('ApexExecutionOverlayActionCommand DELETE REST call', async () => {
    overlayActionCommand = new ApexExecutionOverlayActionCommand(
      requestString,
      actionObjectId
    );
    sendRequestSpy = sinon
      .stub(RequestService.prototype, 'sendRequest')
      .returns(
        Promise.resolve({
          status: 200,
          responseText: '' // Upon a successful delete, nothing is returned
        } as XHRResponse)
      );
    // The expected options needs to contain the request body, url and RestHttpMethodEnum.Post
    const expectedOptions: XHROptions = createExpectedXHROptions(
      requestString,
      expectedDeleteUrl,
      RestHttpMethodEnum.Delete
    );

    await requestService.execute(
      overlayActionCommand,
      RestHttpMethodEnum.Delete
    );

    expect(sendRequestSpy.calledOnce).to.equal(true);
    expect(sendRequestSpy.getCall(0).args[0]).to.deep.equal(expectedOptions);
  });
});

// Support function to create an XHROptions object to verify call args against
export function createExpectedXHROptions(
  requestBody: string | undefined,
  requestUrl: string,
  restHttpMethodEnum: RestHttpMethodEnum
): XHROptions {
  return {
    type: restHttpMethodEnum,
    url: requestUrl,
    timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      Accept: 'application/json',
      Authorization: `OAuth 123`,
      'Content-Length': requestBody
        ? Buffer.byteLength(requestBody, 'utf-8')
        : 0,
      'Sforce-Call-Options': `client=${CLIENT_ID}`
    },
    data: requestBody
  } as XHROptions;
}
