/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Client as FayeClient } from 'faye';
import { Connection } from '@salesforce/core';
import { StreamMessage, TestResultMessage } from './types';
import { nls } from '../i18n';
import { refreshAuth } from '../utils';
import { ApexTestQueueItem, ApexTestQueueItemStatus } from '../tests/types';

const TEST_RESULT_CHANNEL = '/systemTopic/TestResult';
const DEFAULT_STREAMING_TIMEOUT_MS = 14400;

export interface AsyncTestRun {
  runId: string;
  queueItem: ApexTestQueueItem;
}

export class StreamingClient {
  private client: FayeClient;
  private conn: Connection;
  private apiVersion = '36.0';
  public subscribedTestRunId: string;

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

  public constructor(connection: Connection) {
    this.conn = connection;
    const streamUrl = this.getStreamURL(this.conn.instanceUrl);
    this.client = new FayeClient(streamUrl, {
      timeout: DEFAULT_STREAMING_TIMEOUT_MS
    });

    this.client.on('transport:up', () => {
      console.log(nls.localize('streaming_transport_up'));
    });

    this.client.on('transport:down', () => {
      console.log(nls.localize('streaming_transport_down'));
    });

    this.client.addExtension({
      incoming: (
        message: StreamMessage,
        callback: (message: StreamMessage) => void
      ) => {
        if (message && message.error) {
          if (message.channel === '/meta/handshake') {
            this.client.disconnect();
            throw new Error(
              nls.localize('streaming_handshake_fail', message.error)
            );
          }
          console.log(nls.localize('streaming_failure', message.error));
          this.client.disconnect();
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
      throw new Error(nls.localize('no_access_token_found'));
    }
  }

  public handshake(): Promise<void> {
    return new Promise(resolve => {
      this.client.handshake(() => {
        resolve();
      });
    });
  }

  public async subscribe(action: () => Promise<string>): Promise<AsyncTestRun> {
    return new Promise((subscriptionResolve, subscriptionReject) => {
      try {
        this.client.subscribe(
          TEST_RESULT_CHANNEL,
          async (message: TestResultMessage) => {
            const result = await this.handler(message);

            if (result) {
              this.client.disconnect();
              subscriptionResolve({
                runId: this.subscribedTestRunId,
                queueItem: result
              });
            }
          }
        );

        action()
          .then(id => {
            this.subscribedTestRunId = id;
          })
          .catch(e => {
            this.client.disconnect();
            subscriptionReject(e);
          });
      } catch (e) {
        this.client.disconnect();
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

    console.log(nls.localize('streaming_processing_test_run', testRunId));
    return null;
  }

  private async getCompletedTestRun(
    testRunId: string
  ): Promise<ApexTestQueueItem> {
    const queryApexTestQueueItem = `SELECT Id, Status, ApexClassId, TestRunResultId FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`;
    const result = (await this.conn.tooling.query(
      queryApexTestQueueItem
    )) as ApexTestQueueItem;

    if (result.records.length === 0) {
      throw new Error(nls.localize('no_test_queue_results', testRunId));
    }

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
