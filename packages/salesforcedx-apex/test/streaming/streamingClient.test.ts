/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { assert, createSandbox, SinonSandbox } from 'sinon';
import { StreamingClient } from '../../src/streaming';
import { Deferred } from '../../src/streaming/streamingClient';
import { expect } from 'chai';
import { Client, Subscription } from 'faye';
import { fail } from 'assert';
import { Progress } from '../../src';
import { StreamMessage, TestResultMessage } from '../../src/streaming/types';
import {
  ApexTestQueueItemStatus,
  ApexTestProgressValue
} from '../../src/tests/types';
import { nls } from '../../src/i18n';
import { EventEmitter } from 'events';

// The type defined in jsforce doesn't have all Faye client methods.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ApexFayeClient: any = Client;

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
  const $$ = new TestContext();

  beforeEach(async () => {
    sandboxStub = createSandbox();
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    sandboxStub
      .stub(Connection.prototype, 'retrieveMaxApiVersion')
      .resolves('50.0');
    await $$.stubAuths(testData);
    mockConnection = await testData.getConnection();
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should build a valid streaming url', () => {
    const streamClient = new StreamingClient(mockConnection);
    const result = streamClient.getStreamURL('https://na1.salesforce.com/');
    expect(result).to.equal('https://na1.salesforce.com/cometd/50.0');
  });

  it('should initialize Faye Client', () => {
    const stubOn = sandboxStub.stub(ApexFayeClient.prototype, 'on');
    const stubAddExtension = sandboxStub.stub(
      ApexFayeClient.prototype,
      'addExtension'
    );
    new StreamingClient(mockConnection);
    expect(stubOn.calledTwice).to.equal(true);
    expect(stubOn.getCall(0).args[0]).to.equal('transport:up');
    expect(stubOn.getCall(1).args[0]).to.equal('transport:down');
    expect(stubAddExtension.calledOnce).to.equal(true);
  });

  it('should initialize Faye Client header', async () => {
    const stubSetHeader = sandboxStub.stub(
      ApexFayeClient.prototype,
      'setHeader'
    );
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
      expect(e.message).to.equal(nls.localize('noAccessTokenFound'));
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
      .stub(ApexFayeClient.prototype, 'subscribe')
      .throwsException('custom subscribe error');
    const stubDisconnect = sandboxStub.stub(
      ApexFayeClient.prototype,
      'disconnect'
    );
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
      .stub(ApexFayeClient.prototype, 'subscribe')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .returns({} as any);
    const stubDisconnect = sandboxStub.stub(
      ApexFayeClient.prototype,
      'disconnect'
    );
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
      .stub(ApexFayeClient.prototype, 'subscribe')
      .returns(
        new Subscription(() => {
          return;
        })
      );
    const stubDisconnect = sandboxStub.stub(
      ApexFayeClient.prototype,
      'disconnect'
    );
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
        nls.localize('noTestQueueResults', testResultMsg.sobject.Id)
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

  it('should report streamingTransportUp progress', () => {
    const reportStub = sandboxStub.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };
    const mockApexFayeClient = new EventEmitter();
    const stubOn = sandboxStub.stub(ApexFayeClient.prototype, 'on');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient));

    new StreamingClient(mockConnection, progressReporter);
    mockApexFayeClient.emit('transport:up');

    assert.calledOnce(reportStub);
    assert.calledWith(reportStub, {
      type: 'StreamingClientProgress',
      value: 'streamingTransportUp',
      message: nls.localize('streamingTransportUp')
    });
  });

  it('should report streamingTransportDown progress', () => {
    const reportStub = sandboxStub.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };
    const mockApexFayeClient = new EventEmitter();
    const stubOn = sandboxStub.stub(ApexFayeClient.prototype, 'on');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient));

    new StreamingClient(mockConnection, progressReporter);
    mockApexFayeClient.emit('transport:down');

    assert.calledOnce(reportStub);
    assert.calledWith(reportStub, {
      type: 'StreamingClientProgress',
      value: 'streamingTransportDown',
      message: nls.localize('streamingTransportDown')
    });
  });

  it('should report streamingProcessingTestRun progress', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves({
      done: true,
      totalSize: 0,
      records: [
        {
          Id: '707xx0000AGQ3jbQQD',
          Status: ApexTestQueueItemStatus.Processing,
          ApexClassId: '01pxx00000O6tXZQAx',
          TestRunResultId: '05mxx000000TgYuQAw'
        }
      ]
    });
    const reportStub = sandboxStub.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };

    const streamClient = new StreamingClient(mockConnection, progressReporter);
    await streamClient.handler(testResultMsg);

    assert.calledWith(reportStub, {
      type: 'StreamingClientProgress',
      value: 'streamingProcessingTestRun',
      message: nls.localize('streamingProcessingTestRun', '707xx0000AGQ3jbQQD'),
      testRunId: '707xx0000AGQ3jbQQD'
    });
  });

  it('should report test queue progress', async () => {
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves({
      done: true,
      totalSize: 0,
      records: [
        {
          Id: '707xx0000AGQ3jbQQD',
          Status: ApexTestQueueItemStatus.Processing,
          ApexClassId: '01pxx00000O6tXZQAx',
          TestRunResultId: '05mxx000000TgYuQAw'
        }
      ]
    });
    const reportStub = sandboxStub.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };

    const streamClient = new StreamingClient(mockConnection, progressReporter);
    await streamClient.handler(testResultMsg);

    assert.calledWith(reportStub, {
      type: 'TestQueueProgress',
      value: {
        done: true,
        totalSize: 0,
        records: [
          {
            Id: '707xx0000AGQ3jbQQD',
            Status: ApexTestQueueItemStatus.Processing,
            ApexClassId: '01pxx00000O6tXZQAx',
            TestRunResultId: '05mxx000000TgYuQAw'
          }
        ]
      }
    });
  });

  it('should handle 401::Authentication invalid error', async () => {
    const deferred = new Deferred();
    const mockApexFayeClient = new EventEmitter();
    const stubOn = sandboxStub.stub(ApexFayeClient.prototype, 'on');
    const stubInit = sandboxStub.stub(StreamingClient.prototype, 'init');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient));

    const mockFayeIncomingMessage = new EventEmitter();
    const stubAddExtension = sandboxStub.stub(
      ApexFayeClient.prototype,
      'addExtension'
    );
    const stubCallback = sandboxStub.stub();
    stubAddExtension.callsFake(
      (extension: {
        incoming: (
          message: StreamMessage,
          callback: (message: StreamMessage) => void
        ) => Promise<void>;
      }) => {
        mockFayeIncomingMessage.on('incoming', async (message) => {
          await extension.incoming(message, stubCallback);
          deferred.resolve();
        });
      }
    );

    new StreamingClient(mockConnection);
    mockFayeIncomingMessage.emit('incoming', {
      error: '401::Authentication invalid',
      successful: false
    });

    await deferred.promise;
    assert.calledOnce(stubInit);
    assert.calledOnce(stubCallback);
  });

  it('should handle handshake advice', async () => {
    const deferred = new Deferred();
    const mockApexFayeClient = new EventEmitter();
    const stubOn = sandboxStub.stub(ApexFayeClient.prototype, 'on');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient));

    const mockFayeIncomingMessage = new EventEmitter();
    const stubAddExtension = sandboxStub.stub(
      ApexFayeClient.prototype,
      'addExtension'
    );
    const stubCallback = sandboxStub.stub();
    stubAddExtension.callsFake(
      (extension: {
        incoming: (
          message: StreamMessage,
          callback: (message: StreamMessage) => void
        ) => Promise<void>;
      }) => {
        mockFayeIncomingMessage.on('incoming', async (message) => {
          await extension.incoming(message, stubCallback);
          deferred.resolve();
        });
      }
    );

    new StreamingClient(mockConnection);
    mockFayeIncomingMessage.emit('incoming', {
      channel: '/meta/connect',
      clientId: 'mockClientId',
      advice: {
        reconnect: 'handshake',
        interval: 500
      },
      error: '403::Unknown client',
      successful: false,
      id: 'b'
    });

    await deferred.promise;
    assert.calledOnce(stubCallback);
  });

  it('should handle other 403 errors', async () => {
    const deferred = new Deferred();
    const mockApexFayeClient = new EventEmitter();
    const stubOn = sandboxStub.stub(ApexFayeClient.prototype, 'on');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient));

    const mockFayeIncomingMessage = new EventEmitter();
    const stubAddExtension = sandboxStub.stub(
      ApexFayeClient.prototype,
      'addExtension'
    );
    const stubCallback = sandboxStub.stub();
    stubAddExtension.callsFake(
      (extension: {
        incoming: (
          message: StreamMessage,
          callback: (message: StreamMessage) => void
        ) => Promise<void>;
      }) => {
        mockFayeIncomingMessage.on('incoming', async (message) => {
          await extension.incoming(message, stubCallback);
          deferred.resolve();
        });
      }
    );

    new StreamingClient(mockConnection);
    mockFayeIncomingMessage.emit('incoming', {
      error: '403::Unknown client',
      successful: false
    });

    await deferred.promise;
    assert.calledOnce(stubCallback);
  });

  it('should call query test queue items at an interval', async () => {
    sandboxStub.stub(ApexFayeClient.prototype, 'subscribe');
    const queryResponse = {
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '7092M000000Vt94QAC',
          Status: ApexTestQueueItemStatus.Processing,
          ApexClassId: '01p2M00000O6tXZQAZ',
          TestRunResultId: '05m2M000000TgYuQAK'
        }
      ]
    };
    const mockToolingQuery = sandboxStub.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves(queryResponse);

    const setIntervalStub = sandboxStub.stub(global, 'setInterval');
    setIntervalStub.callsFake((callback: Function) => callback.call(null));

    const streamClient = new StreamingClient(mockConnection);
    streamClient.subscribe(() => Promise.resolve('707xx0000AGQ3jbQQD'));

    await Promise.resolve();
    assert.calledOnce(mockToolingQuery);
  });

  it('should return the results, disconnect and clear interval on test completion', async () => {
    sandboxStub.stub(ApexFayeClient.prototype, 'subscribe');
    const disconnectStub = sandboxStub.stub(
      ApexFayeClient.prototype,
      'disconnect'
    );
    const mockRunId = '707xx0000AGQ3jbQQD';
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
    const setIntervalStub = sandboxStub.stub(global, 'setInterval');
    setIntervalStub.callsFake((callback: Function) => callback.call(null));
    const clearIntervalStub = sandboxStub.stub(global, 'clearInterval');

    const streamClient = new StreamingClient(mockConnection);
    const result = await streamClient.subscribe(() =>
      Promise.resolve(mockRunId)
    );

    expect(result).to.eql({
      runId: mockRunId,
      queueItem: queryResponse
    });
    assert.calledOnce(mockToolingQuery);
    assert.calledOnce(disconnectStub);
    assert.calledOnce(clearIntervalStub);
  });
});
