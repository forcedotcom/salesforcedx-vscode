/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Client as FayeClient } from 'faye';
import { Connection } from '@salesforce/core';
import {
  RetreiveResultsInterval,
  StreamMessage,
  StreamingErrors,
  TestResultMessage
} from './types';
import { Progress } from '../common';
import { nls } from '../i18n';
import { refreshAuth } from '../utils';
import {
  ApexTestProgressValue,
  ApexTestQueueItem,
  ApexTestQueueItemStatus
} from '../tests/types';

const TEST_RESULT_CHANNEL = '/systemTopic/TestResult';
const DEFAULT_STREAMING_TIMEOUT_MS = 14400;

export interface AsyncTestRun {
  runId: string;
  queueItem: ApexTestQueueItem;
}

export class Deferred<T> {
  public promise: Promise<T>;
  public resolve: Function;
  constructor() {
    this.promise = new Promise(resolve => (this.resolve = resolve));
  }
}

export class StreamingClient {
  private client: FayeClient;
  private conn: Connection;
  private progress?: Progress<ApexTestProgressValue>;
  private apiVersion = '36.0';
  public subscribedTestRunId: string;
  private subscribedTestRunIdDeferred = new Deferred<string>();
  public get subscribedTestRunIdPromise(): Promise<string> {
    return this.subscribedTestRunIdDeferred.promise;
  }

  private removeTrailingSlashURL(instanceUrl?: string): string {
    return instanceUrl ? instanceUrl.replace(/\/+$/, '') : '';
  }

  public getStreamURL(instanceUrl: string): string {
    const urlElements = [
      this.removeTrailingSlashURL(instanceUrl),
      'cometd',
      this.apiVersion
    ];
    return urlElements.join('/');
  }

  public constructor(
    connection: Connection,
    progress?: Progress<ApexTestProgressValue>
  ) {
    this.conn = connection;
    this.progress = progress;
    const streamUrl = this.getStreamURL(this.conn.instanceUrl);
    this.client = new FayeClient(streamUrl, {
      timeout: DEFAULT_STREAMING_TIMEOUT_MS
    });

    this.client.on('transport:up', () => {
      this.progress?.report({
        type: 'StreamingClientProgress',
        value: 'streamingTransportUp',
        message: nls.localize('streamingTransportUp')
      });
    });

    this.client.on('transport:down', () => {
      this.progress?.report({
        type: 'StreamingClientProgress',
        value: 'streamingTransportDown',
        message: nls.localize('streamingTransportDown')
      });
    });

    this.client.addExtension({
      incoming: async (
        message: StreamMessage,
        callback: (message: StreamMessage) => void
      ) => {
        if (message && message.error) {
          // throw errors on handshake errors
          if (message.channel === '/meta/handshake') {
            this.disconnect();
            throw new Error(
              nls.localize('streamingHandshakeFail', message.error)
            );
          }

          // refresh auth on 401 errors
          if (message.error === StreamingErrors.ERROR_AUTH_INVALID) {
            await this.init();
            callback(message);
            return;
          }

          // call faye callback on handshake advice
          if (message.advice && message.advice.reconnect === 'handshake') {
            callback(message);
            return;
          }

          // call faye callback on 403 unknown client errors
          if (message.error === StreamingErrors.ERROR_UNKNOWN_CLIENT_ID) {
            callback(message);
            return;
          }

          // default: disconnect and throw error
          this.disconnect();
          throw new Error(message.error);
        }
        callback(message);
      }
    });
  }

  // NOTE: There's an intermittent auth issue with Streaming API that requires the connection to be refreshed
  // The builtin org.refreshAuth() util only refreshes the connection associated with the instance of the org you provide, not all connections associated with that username's orgs
  public async init(): Promise<void> {
    await refreshAuth(this.conn);

    const accessToken = this.conn.getConnectionOptions().accessToken;
    if (accessToken) {
      this.client.setHeader('Authorization', `OAuth ${accessToken}`);
    } else {
      throw new Error(nls.localize('noAccessTokenFound'));
    }
  }

  public handshake(): Promise<void> {
    return new Promise(resolve => {
      this.client.handshake(() => {
        resolve();
      });
    });
  }

  public disconnect(): void {
    this.client.disconnect();
    this.hasDisconnected = true;
  }

  public hasDisconnected = false;

  public async subscribe(
    action?: () => Promise<string>,
    testRunId?: string
  ): Promise<AsyncTestRun> {
    return new Promise((subscriptionResolve, subscriptionReject) => {
      let intervalId: NodeJS.Timeout;
      try {
        this.client.subscribe(
          TEST_RESULT_CHANNEL,
          async (message: TestResultMessage) => {
            const result = await this.handler(message);

            if (result) {
              this.disconnect();
              clearInterval(intervalId);
              subscriptionResolve({
                runId: this.subscribedTestRunId,
                queueItem: result
              });
            }
          }
        );

        if (action) {
          action()
            .then(id => {
              this.subscribedTestRunId = id;
              this.subscribedTestRunIdDeferred.resolve(id);

              if (!this.hasDisconnected) {
                intervalId = setInterval(async () => {
                  const result = await this.getCompletedTestRun(id);
                  if (result) {
                    this.disconnect();
                    clearInterval(intervalId);
                    subscriptionResolve({
                      runId: this.subscribedTestRunId,
                      queueItem: result
                    });
                  }
                }, RetreiveResultsInterval);
              }
            })
            .catch(e => {
              this.disconnect();
              clearInterval(intervalId);
              subscriptionReject(e);
            });
        } else {
          this.subscribedTestRunId = testRunId;
          this.subscribedTestRunIdDeferred.resolve(testRunId);
        }
      } catch (e) {
        this.disconnect();
        clearInterval(intervalId);
        subscriptionReject(e);
      }
    });
  }

  private isValidTestRunID(testRunId: string, subscribedId?: string): boolean {
    if (testRunId.length !== 15 && testRunId.length !== 18) {
      return false;
    }

    const testRunId15char = testRunId.substring(0, 14);
    if (subscribedId) {
      const subscribedTestRunId15char = subscribedId.substring(0, 14);
      return subscribedTestRunId15char === testRunId15char;
    }
    return true;
  }

  public async handler(
    message?: TestResultMessage,
    runId?: string
  ): Promise<ApexTestQueueItem> {
    const testRunId = runId || message.sobject.Id;
    if (!this.isValidTestRunID(testRunId, this.subscribedTestRunId)) {
      return null;
    }

    const result = await this.getCompletedTestRun(testRunId);
    if (result) {
      return result;
    }

    this.progress?.report({
      type: 'StreamingClientProgress',
      value: 'streamingProcessingTestRun',
      message: nls.localize('streamingProcessingTestRun', testRunId),
      testRunId
    });
    return null;
  }

  private async getCompletedTestRun(
    testRunId: string
  ): Promise<ApexTestQueueItem> {
    const queryApexTestQueueItem = `SELECT Id, Status, ApexClassId, TestRunResultId FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`;
    const result = (await this.conn.tooling.autoFetchQuery(
      queryApexTestQueueItem
    )) as ApexTestQueueItem;

    if (result.records.length === 0) {
      throw new Error(nls.localize('noTestQueueResults', testRunId));
    }

    this.progress?.report({
      type: 'TestQueueProgress',
      value: result
    });

    for (let i = 0; i < result.records.length; i++) {
      const item = result.records[i];
      if (
        item.Status === ApexTestQueueItemStatus.Queued ||
        item.Status === ApexTestQueueItemStatus.Holding ||
        item.Status === ApexTestQueueItemStatus.Preparing ||
        item.Status === ApexTestQueueItemStatus.Processing
      ) {
        return null;
      }
    }
    return result;
  }
}
