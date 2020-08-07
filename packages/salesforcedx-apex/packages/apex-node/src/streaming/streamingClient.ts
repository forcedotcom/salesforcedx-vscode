/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Client as FayeClient } from 'faye';
import { Connection, Org } from '@salesforce/core';
import { ApexTestQueueItem, ApexTestQueueItemStatus } from '../tests/types';
import { StreamMessage, TestResultMessage } from './types';
import { nls } from '../i18n';

const TEST_RESULT_CHANNEL = '/systemTopic/TestResult';
const DEFAULT_STREAMING_TIMEOUT_MS = 14400;

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
        if (message && message.channel === '/meta/handshake' && message.error) {
          throw new Error(
            nls.localize('streaming_handshake_fail', message.error)
          );
        }
        callback(message);
      }
    });
  }

  public async init(): Promise<void> {
    const username = this.conn.getUsername();
    const org = await Org.create({ aliasOrUsername: username });
    await org.refreshAuth();

    const accessToken = this.conn.getConnectionOptions().accessToken;
    if (accessToken) {
      this.client.setHeader('Authorization', `OAuth ${accessToken}`);
    } else {
      throw new Error(nls.localize('no_access_token_found'));
    }
  }

  public async subscribe(testRunId: string): Promise<ApexTestQueueItem> {
    this.subscribedTestRunId = testRunId;
    return new Promise((subscriptionResolve, subscriptionReject) => {
      try {
        this.client.subscribe(
          TEST_RESULT_CHANNEL,
          async (message: TestResultMessage) => {
            const result = await this.handler(message);

            if (result) {
              this.client.disconnect();
              subscriptionResolve(result);
            }
          }
        );
      } catch (e) {
        this.client.disconnect();
        subscriptionReject(e);
      }
    });
  }

  private isValidTestRunID(testRunId: string): boolean {
    if (testRunId.length !== 15 && testRunId.length !== 18) {
      return false;
    }

    const testRunId15char = testRunId.substring(0, 14);
    const subscribedTestRunId15char = this.subscribedTestRunId.substring(0, 14);
    return subscribedTestRunId15char === testRunId15char;
  }

  public async handler(message: TestResultMessage): Promise<ApexTestQueueItem> {
    const testRunId = message.sobject.Id;
    if (!this.isValidTestRunID(testRunId)) {
      return null;
    }

    const queryApexTestQueueItem = `SELECT Id, Status, ApexClassId, TestRunResultId FROM ApexTestQueueItem WHERE ParentJobId = '${testRunId}'`;
    let completedRecordProcess = true;
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
        completedRecordProcess = false;
        break;
      }
    }

    if (completedRecordProcess) {
      return result;
    } else {
      console.log(nls.localize('streaming_processing_test_run', testRunId));
    }
    return null;
  }
}
