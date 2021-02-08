/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { createSandbox, SinonSandbox } from 'sinon';
import { StreamingClient } from '../../src/streaming';
import { expect } from 'chai';
import { Client as FayeClient, Subscription } from 'faye';
import { fail } from 'assert';
import { TestResultMessage } from '../../src/streaming/types';
import { ApexTestQueueItemStatus } from '../../src/tests/types';
import { nls } from '../../src/i18n';

const $$ = testSetup();
let mockConnection: Connection;
let sandboxStub: SinonSandbox;
const testData = new MockTestOrgData();
const testResultMsg: TestResultMessage = {
  event: {
    createdDate: '2020-08-03T22:58:58.000+0000',
    type: 'updated'
  },
  sobject: {
    Id: '707xx0000AGQ3jbQQD'
  }
};
describe('Streaming API Client', () => {
  beforeEach(async () => {
    sandboxStub = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    sandboxStub
      .stub(Connection.prototype, 'retrieveMaxApiVersion')
      .resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should build a valid streaming url', () => {
    const streamClient = new StreamingClient(mockConnection);
    const result = streamClient.getStreamURL('https://na1.salesforce.com/');
    expect(result).to.equal('https://na1.salesforce.com/cometd/36.0');
  });

  it('should initialize Faye Client', () => {
    const stubOn = sandboxStub.stub(FayeClient.prototype, 'on');
    const stubAddExtension = sandboxStub.stub(
      FayeClient.prototype,
      'addExtension'
    );
    new StreamingClient(mockConnection);
    expect(stubOn.calledTwice).to.equal(true);
    expect(stubOn.getCall(0).args[0]).to.equal('transport:up');
    expect(stubOn.getCall(1).args[0]).to.equal('transport:down');
    expect(stubAddExtension.calledOnce).to.equal(true);
  });

  it('should initialize Faye Client header', async () => {
    const stubSetHeader = sandboxStub.stub(FayeClient.prototype, 'setHeader');
    const streamClient = new StreamingClient(mockConnection);
    await streamClient.init();
    expect(stubSetHeader.calledOnce).to.equal(true);
    expect(stubSetHeader.getCall(0).args[0]).to.equal('Authorization');
    const accessToken = mockConnection.getConnectionOptions().accessToken;
    expect(stubSetHeader.getCall(0).args[1]).to.equal(`OAuth ${accessToken}`);
  });

  it('should initialize Faye Client throws authentication error', async () => {
    sandboxStub.stub(Connection.prototype, 'getConnectionOptions').returns({
      accessToken: undefined
    });
    const streamClient = new StreamingClient(mockConnection);
    try {
      await streamClient.init();
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('no_access_token_found'));
    }
  });

  it('should force refresh the connection during init', async () => {
    const requestStub = sandboxStub
      .stub(mockConnection, 'baseUrl')
      .returns('66568xxxx');

    const streamClient = new StreamingClient(mockConnection);
    await streamClient.init();
    expect(requestStub.calledOnce).to.be.true;
  });

  it('should disconnect when subscribe throws an error', async () => {
    const stubSubscribe = sandboxStub
      .stub(FayeClient.prototype, 'subscribe')
      .throwsException('custom subscribe error');
    const stubDisconnect = sandboxStub.stub(FayeClient.prototype, 'disconnect');
    const streamClient = new StreamingClient(mockConnection);
    try {
      await streamClient.subscribe(() => Promise.resolve('707xx0000AGQ3jbQQD'));
      fail('Test should have thrown an error');
    } catch (e) {
      expect(stubSubscribe.calledOnce).to.equal(true);
      expect(e.name).to.equal('custom subscribe error');
      expect(stubDisconnect.calledOnce).to.equal(true);
    }
  });

  it('should disconnect when subscribe action throws an error', async () => {
    const stubSubscribe = sandboxStub
      .stub(FayeClient.prototype, 'subscribe')
      .returns(new Subscription());
    const stubDisconnect = sandboxStub.stub(FayeClient.prototype, 'disconnect');
    const streamClient = new StreamingClient(mockConnection);

    try {
      await streamClient.subscribe(() => Promise.reject(new Error('Broken')));
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal('Broken');
    }
    expect(stubSubscribe.calledOnce).to.equal(true);
    expect(stubDisconnect.calledOnce).to.equal(true);
  });

  it.skip('should capture test run ID in subscribe', async () => {
    const stubSubscribe = sandboxStub
      .stub(FayeClient.prototype, 'subscribe')
      .returns(new Subscription());
    const stubDisconnect = sandboxStub.stub(FayeClient.prototype, 'disconnect');
    const streamClient = new StreamingClient(mockConnection);

    const result = await streamClient.subscribe(() =>
      Promise.resolve('707xx0000AGQ3jbQQD')
    );
    expect(result).to.equal('707xx0000AGQ3jbQQD');
    expect(streamClient.subscribedTestRunId).to.equal('707xx0000AGQ3jbQQD');
    expect(stubSubscribe.calledOnce).to.equal(true);
    expect(stubDisconnect.calledOnce).to.equal(false);
  });

  it('should throw error if handler can not find test records', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves({
      done: true,
      totalSize: 0,
      records: []
    });
    const streamClient = new StreamingClient(mockConnection);
    try {
      streamClient.subscribedTestRunId = '707xx0000AGQ3jbQQD';
      await streamClient.handler(testResultMsg);
      fail('Test should have thrown an error');
    } catch (e) {
      expect(mockToolingQuery.calledOnce).to.equal(true);
      expect(mockToolingQuery.getCall(0).args[0]).to.equal(
        `SELECT Id, Status, ApexClassId, TestRunResultId FROM ApexTestQueueItem WHERE ParentJobId = '${testResultMsg.sobject.Id}'`
      );
      expect(e.message).to.equal(
        nls.localize('no_test_queue_results', testResultMsg.sobject.Id)
      );
    }
  });

  it('should not run a query if the subscribed test run id does not match the message test run id', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    const streamClient = new StreamingClient(mockConnection);
    streamClient.subscribedTestRunId = '707xx0000gtQ3jx3x5';
    const streamHandlerResult = await streamClient.handler(testResultMsg);
    expect(mockToolingQuery.calledOnce).to.equal(false);
    expect(streamHandlerResult).to.equal(null);
  });

  it('should return ApexTestQueueItem records from handler function', async () => {
    const queryResponse = {
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '7092M000000Vt94QAC',
          Status: ApexTestQueueItemStatus.Completed,
          ApexClassId: '01p2M00000O6tXZQAZ',
          TestRunResultId: '05m2M000000TgYuQAK'
        }
      ]
    };
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves(queryResponse);
    const streamClient = new StreamingClient(mockConnection);
    streamClient.subscribedTestRunId = '707xx0000AGQ3jbQQD';
    const results = await streamClient.handler(testResultMsg);
    expect(mockToolingQuery.calledOnce).to.equal(true);
    expect(results).to.deep.equal(queryResponse);
  });

  it('should return no results when a ApexTestQueueItem record has a pending status', async () => {
    const queryResponse = {
      done: true,
      totalSize: 2,
      records: [
        {
          Id: '7092M000000Vt94QAC',
          Status: ApexTestQueueItemStatus.Completed,
          ApexClassId: '01p2M00000O6tXZQAZ',
          TestRunResultId: '05m2M000000TgYuQAK'
        },
        {
          Id: '709xx000000Vt94QAD',
          Status: ApexTestQueueItemStatus.Processing,
          ApexClassId: '01pxx00000O6tXZQAx',
          TestRunResultId: '05mxx000000TgYuQAw'
        }
      ]
    };

    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves(queryResponse);
    const streamClient = new StreamingClient(mockConnection);
    streamClient.subscribedTestRunId = '707xx0000AGQ3jbQQD';
    const results = await streamClient.handler(testResultMsg);
    expect(mockToolingQuery.calledOnce).to.equal(true);
    expect(results).to.equal(null);
  });
});
