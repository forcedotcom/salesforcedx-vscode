/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { StreamingClient } from '../../src/streaming';
import { Deferred } from '../../src/streaming/streamingClient';
import { Client, Subscription } from 'faye';
import { fail } from 'node:assert';
import { Progress } from '../../src';
import { StreamMessage, TestResultMessage } from '../../src/streaming/types';
import { ApexTestQueueItemStatus, ApexTestProgressValue } from '../../src/tests/types';
import { nls } from '../../src/i18n';
import { EventEmitter } from 'node:events';
import { Duration } from '@salesforce/kit';

// The type defined in jsforce doesn't have all Faye client methods.

const ApexFayeClient: any = Client;

let mockConnection: Connection;
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
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    await $$.stubAuths(testData);
    mockConnection = await testData.getConnection();
  });

  it('should build a valid streaming url', () => {
    const streamClient = new StreamingClient(mockConnection);
    const result = streamClient.getStreamURL('https://na1.salesforce.com/');
    expect(result).toBe('https://na1.salesforce.com/cometd/50.0');
  });

  it('should initialize Faye Client', () => {
    const stubOn = $$.SANDBOX.stub(ApexFayeClient.prototype, 'on');
    const stubAddExtension = $$.SANDBOX.stub(ApexFayeClient.prototype, 'addExtension');
    new StreamingClient(mockConnection);
    expect(stubOn.calledTwice).toBe(true);
    expect(stubOn.getCall(0).args[0]).toBe('transport:up');
    expect(stubOn.getCall(1).args[0]).toBe('transport:down');
    expect(stubAddExtension.calledOnce).toBe(true);
  });

  it('should initialize Faye Client header', async () => {
    const stubSetHeader = $$.SANDBOX.stub(ApexFayeClient.prototype, 'setHeader');
    const streamClient = new StreamingClient(mockConnection);
    await streamClient.init();
    expect(stubSetHeader.calledOnce).toBe(true);
    expect(stubSetHeader.getCall(0).args[0]).toBe('Authorization');
    const accessToken = mockConnection.getConnectionOptions().accessToken;
    expect(stubSetHeader.getCall(0).args[1]).toBe(`OAuth ${accessToken}`);
  });

  it('should initialize Faye Client throws authentication error', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'getConnectionOptions').returns({
      accessToken: undefined
    });
    const streamClient = new StreamingClient(mockConnection);
    try {
      await streamClient.init();
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).toBe(nls.localize('noAccessTokenFound'));
    }
  });

  it('should force refresh the connection during init', async () => {
    const requestStub = $$.SANDBOX.stub(mockConnection, 'baseUrl').returns('66568xxxx');

    const streamClient = new StreamingClient(mockConnection);
    await streamClient.init();
    expect(requestStub.calledOnce).toBe(true);
  });

  it('should disconnect when subscribe throws an error', async () => {
    const stubSubscribe = $$.SANDBOX.stub(ApexFayeClient.prototype, 'subscribe').throwsException(
      'custom subscribe error'
    );
    const stubDisconnect = $$.SANDBOX.stub(ApexFayeClient.prototype, 'disconnect');
    const streamClient = new StreamingClient(mockConnection);
    try {
      await streamClient.subscribe(() => Promise.resolve('707xx0000AGQ3jbQQD'));
      fail('Test should have thrown an error');
    } catch (e) {
      expect(stubSubscribe.calledOnce).toBe(true);
      expect(e.name).toBe('custom subscribe error');
      expect(stubDisconnect.calledOnce).toBe(true);
    }
  });

  it('should disconnect when subscribe action throws an error', async () => {
    const stubSubscribe = $$.SANDBOX.stub(ApexFayeClient.prototype, 'subscribe')

      .returns({} as any);
    const stubDisconnect = $$.SANDBOX.stub(ApexFayeClient.prototype, 'disconnect');
    const streamClient = new StreamingClient(mockConnection);

    try {
      await streamClient.subscribe(() => Promise.reject(new Error('Broken')));
      fail('Test should have thrown an error');
    } catch (e) {
      expect(e.message).toBe('Broken');
    }
    expect(stubSubscribe.calledOnce).toBe(true);
    expect(stubDisconnect.calledOnce).toBe(true);
  });

  it.skip('should capture test run ID in subscribe', async () => {
    const stubSubscribe = $$.SANDBOX.stub(ApexFayeClient.prototype, 'subscribe').returns(
      new Subscription(() => undefined)
    );
    const stubDisconnect = $$.SANDBOX.stub(ApexFayeClient.prototype, 'disconnect');
    const streamClient = new StreamingClient(mockConnection);

    const result = await streamClient.subscribe(() => Promise.resolve('707xx0000AGQ3jbQQD'));
    expect(result).toBe('707xx0000AGQ3jbQQD');
    expect(streamClient.subscribedTestRunId).toBe('707xx0000AGQ3jbQQD');
    expect(stubSubscribe.calledOnce).toBe(true);
    expect(stubDisconnect.calledOnce).toBe(false);
  });

  it('should throw error if handler can not find test records', async () => {
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
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
      expect(mockToolingQuery.calledOnce).toBe(true);
      expect(mockToolingQuery.getCall(0).args[0]).toBe(
        `SELECT Id, Status, ApexClassId, TestRunResultId FROM ApexTestQueueItem WHERE ParentJobId = '${testResultMsg.sobject.Id}'`
      );
      expect(e.message).toBe(nls.localize('noTestQueueResults', testResultMsg.sobject.Id));
    }
  });

  it('should not run a query if the subscribed test run id does not match the message test run id', async () => {
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    const streamClient = new StreamingClient(mockConnection);
    streamClient.subscribedTestRunId = '707xx0000gtQ3jx3x5';
    const streamHandlerResult = await streamClient.handler(testResultMsg);
    expect(mockToolingQuery.calledOnce).toBe(false);
    expect(streamHandlerResult).toBeNull();
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
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves(queryResponse);
    const streamClient = new StreamingClient(mockConnection);
    streamClient.subscribedTestRunId = '707xx0000AGQ3jbQQD';
    const results = await streamClient.handler(testResultMsg);
    expect(mockToolingQuery.calledOnce).toBe(true);
    expect(results).toEqual(queryResponse);
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

    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves(queryResponse);
    const streamClient = new StreamingClient(mockConnection);
    streamClient.subscribedTestRunId = '707xx0000AGQ3jbQQD';
    const results = await streamClient.handler(testResultMsg);
    expect(mockToolingQuery.calledOnce).toBe(true);
    expect(results).toBeNull();
  });

  it('should report streamingTransportUp progress', () => {
    const reportStub = $$.SANDBOX.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };
    const mockApexFayeClient = new EventEmitter();
    const stubOn = $$.SANDBOX.stub(ApexFayeClient.prototype, 'on');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient) as any);

    new StreamingClient(mockConnection, progressReporter);
    mockApexFayeClient.emit('transport:up');

    expect(reportStub.calledOnce).toBe(true);
    expect(
      reportStub.calledWith({
        type: 'StreamingClientProgress',
        value: 'streamingTransportUp',
        message: nls.localize('streamingTransportUp')
      })
    ).toBe(true);
  });

  it('should report streamingTransportDown progress', () => {
    const reportStub = $$.SANDBOX.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };
    const mockApexFayeClient = new EventEmitter();
    const stubOn = $$.SANDBOX.stub(ApexFayeClient.prototype, 'on');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient) as any);

    new StreamingClient(mockConnection, progressReporter);
    mockApexFayeClient.emit('transport:down');

    expect(reportStub.calledOnce).toBe(true);
    expect(
      reportStub.calledWith({
        type: 'StreamingClientProgress',
        value: 'streamingTransportDown',
        message: nls.localize('streamingTransportDown')
      })
    ).toBe(true);
  });

  it('should report streamingProcessingTestRun progress', async () => {
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
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
    const reportStub = $$.SANDBOX.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };

    const streamClient = new StreamingClient(mockConnection, progressReporter);
    await streamClient.handler(testResultMsg);

    expect(
      reportStub.calledWith({
        type: 'StreamingClientProgress',
        value: 'streamingProcessingTestRun',
        message: nls.localize('streamingProcessingTestRun', '707xx0000AGQ3jbQQD'),
        testRunId: '707xx0000AGQ3jbQQD'
      })
    ).toBe(true);
  });

  it('should report test queue progress', async () => {
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
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
    const reportStub = $$.SANDBOX.stub();
    const progressReporter: Progress<ApexTestProgressValue> = {
      report: reportStub
    };

    const streamClient = new StreamingClient(mockConnection, progressReporter);
    await streamClient.handler(testResultMsg);

    expect(
      reportStub.getCall(0).calledWith({
        type: 'TestQueueProgress',
        value: {
          done: true,
          totalSize: 1,
          records: [
            {
              Id: '707xx0000AGQ3jbQQD',
              Status: ApexTestQueueItemStatus.Processing,
              ApexClassId: '01pxx00000O6tXZQAx',
              TestRunResultId: '05mxx000000TgYuQAw'
            }
          ]
        }
      })
    ).toBe(true);
  });

  it('should handle 401::Authentication invalid error', async () => {
    const deferred = new Deferred();
    const mockApexFayeClient = new EventEmitter();
    const stubOn = $$.SANDBOX.stub(ApexFayeClient.prototype, 'on');
    const stubInit = $$.SANDBOX.stub(StreamingClient.prototype, 'init');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient) as any);

    const mockFayeIncomingMessage = new EventEmitter();
    const stubAddExtension = $$.SANDBOX.stub(ApexFayeClient.prototype, 'addExtension');
    const stubCallback = $$.SANDBOX.stub();
    (stubAddExtension.callsFake as (fn: unknown) => unknown)(
      (extension: {
        incoming: (message: StreamMessage, callback: (message: StreamMessage) => void) => Promise<void>;
      }) => {
        mockFayeIncomingMessage.on('incoming', async message => {
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
    expect(stubInit.calledOnce).toBe(true);
    expect(stubCallback.calledOnce).toBe(true);
  });

  it('should handle handshake advice', async () => {
    const deferred = new Deferred();
    const mockApexFayeClient = new EventEmitter();
    const stubOn = $$.SANDBOX.stub(ApexFayeClient.prototype, 'on');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient) as any);

    const mockFayeIncomingMessage = new EventEmitter();
    const stubAddExtension = $$.SANDBOX.stub(ApexFayeClient.prototype, 'addExtension');
    const stubCallback = $$.SANDBOX.stub();
    (stubAddExtension.callsFake as (fn: unknown) => unknown)(
      (extension: {
        incoming: (message: StreamMessage, callback: (message: StreamMessage) => void) => Promise<void>;
      }) => {
        mockFayeIncomingMessage.on('incoming', async message => {
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
    expect(stubCallback.calledOnce).toBe(true);
  });

  it('should handle other 403 errors', async () => {
    const deferred = new Deferred();
    const mockApexFayeClient = new EventEmitter();
    const stubOn = $$.SANDBOX.stub(ApexFayeClient.prototype, 'on');
    stubOn.callsFake(mockApexFayeClient.on.bind(mockApexFayeClient) as any);

    const mockFayeIncomingMessage = new EventEmitter();
    const stubAddExtension = $$.SANDBOX.stub(ApexFayeClient.prototype, 'addExtension');
    const stubCallback = $$.SANDBOX.stub();
    (stubAddExtension.callsFake as (fn: unknown) => unknown)(
      (extension: {
        incoming: (message: StreamMessage, callback: (message: StreamMessage) => void) => Promise<void>;
      }) => {
        mockFayeIncomingMessage.on('incoming', async message => {
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
    expect(stubCallback.calledOnce).toBe(true);
  });

  it('should call query test queue items at an interval', async () => {
    $$.SANDBOX.stub(ApexFayeClient.prototype, 'subscribe');
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
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves(queryResponse);

    const setIntervalStub = $$.SANDBOX.stub(global, 'setInterval');
    setIntervalStub.callsFake((callback: Function) => callback.call(null));

    const streamClient = new StreamingClient(mockConnection);
    void streamClient.subscribe(() => Promise.resolve('707xx0000AGQ3jbQQD'));

    await Promise.resolve();
    expect(mockToolingQuery.calledOnce).toBe(true);
  });

  it('should return the run id, disconnect and clear interval on timeout', async () => {
    $$.SANDBOX.stub(ApexFayeClient.prototype, 'subscribe');
    const disconnectStub = $$.SANDBOX.stub(ApexFayeClient.prototype, 'disconnect');
    const mockRunId = '707xx0000AGQ3jbQQD';

    // The faked setInterval invokes the poll callback synchronously; stub the
    // poll to resolve null so the timeout path (not a completed run) wins.
    $$.SANDBOX.stub(
      StreamingClient.prototype as unknown as {
        getCompletedTestRun: () => Promise<null>;
      },
      'getCompletedTestRun'
    ).resolves(null);
    const setIntervalStub = $$.SANDBOX.stub(global, 'setInterval');
    setIntervalStub.callsFake(((callback: Function) => callback.call(null)) as any);
    const clearIntervalStub = $$.SANDBOX.stub(global, 'clearInterval');

    const streamClient = new StreamingClient(mockConnection);
    const result = await streamClient.subscribe(() => Promise.resolve(mockRunId), mockRunId, Duration.milliseconds(10));

    expect(result).toEqual({
      testRunId: mockRunId
    });
    expect(disconnectStub.calledOnce).toBe(true);
    expect(clearIntervalStub.calledOnce).toBe(true);
  });

  it('should return the results, disconnect and clear interval on test completion', async () => {
    $$.SANDBOX.stub(ApexFayeClient.prototype, 'subscribe');
    const disconnectStub = $$.SANDBOX.stub(ApexFayeClient.prototype, 'disconnect');
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
    const mockToolingQuery = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    mockToolingQuery.resolves(queryResponse);
    const setIntervalStub = $$.SANDBOX.stub(global, 'setInterval');
    setIntervalStub.callsFake(((callback: Function) => callback.call(null)) as any);
    const clearIntervalStub = $$.SANDBOX.stub(global, 'clearInterval');
    const clearTimeoutStub = $$.SANDBOX.stub(global, 'clearTimeout');

    const streamClient = new StreamingClient(mockConnection);
    const result = await streamClient.subscribe(() => Promise.resolve(mockRunId));

    expect(result).toEqual({
      runId: mockRunId,
      queueItem: queryResponse
    });
    expect(mockToolingQuery.calledOnce).toBe(true);
    expect(disconnectStub.calledOnce).toBe(true);
    expect(clearIntervalStub.calledOnce).toBe(true);
    expect(clearTimeoutStub.calledOnce).toBe(true);
  });
});
