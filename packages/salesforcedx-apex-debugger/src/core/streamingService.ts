/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RequestService } from '@salesforce/salesforcedx-utils';
import { ApexDebuggerEventType, StreamingClient, StreamingClientInfo } from './streamingClient';

export class StreamingService {
  public static SYSTEM_EVENT_CHANNEL = '/systemTopic/ApexDebuggerSystemEvent';
  public static USER_EVENT_CHANNEL = '/systemTopic/ApexDebuggerEvent';
  public static DEFAULT_TIMEOUT = 14400;
  private static instance: StreamingService;
  private readonly apiVersion = '41.0';
  private systemEventClient!: StreamingClient;
  private userEventClient!: StreamingClient;

  public static getInstance() {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  public getClient(type: ApexDebuggerEventType): StreamingClient | undefined {
    switch (type) {
      case 'ApexException':
      case 'Debug':
      case 'LogLine': {
        return this.userEventClient;
      }
      case 'OrgChange':
      case 'Ready':
      case 'RequestFinished':
      case 'RequestStarted':
      case 'Resumed':
      case 'SessionTerminated':
      case 'Stopped':
      case 'SystemGack':
      case 'SystemInfo':
      case 'SystemWarning': {
        return this.systemEventClient;
      }
    }
  }

  public hasProcessedEvent(type: ApexDebuggerEventType, replayId: number): boolean {
    const client = this.getClient(type);
    if (client && replayId > client.getReplayId()) {
      return false;
    }
    return true;
  }

  public markEventProcessed(type: ApexDebuggerEventType, replayId: number): void {
    const client = this.getClient(type);
    if (client) {
      client.setReplayId(replayId);
    }
  }

  public async subscribe(
    projectPath: string,
    requestService: RequestService,
    systemEventClientInfo: StreamingClientInfo,
    userEventClientInfo: StreamingClientInfo
  ): Promise<boolean> {
    const urlElements = [this.removeTrailingSlashURL(requestService.instanceUrl), 'cometd', this.apiVersion];
    const streamUrl = urlElements.join('/');

    this.systemEventClient = new StreamingClient(streamUrl, requestService, systemEventClientInfo);
    this.userEventClient = new StreamingClient(streamUrl, requestService, userEventClientInfo);

    await this.systemEventClient.subscribe();
    await this.userEventClient.subscribe();
    return Promise.resolve(this.isReady());
  }

  private removeTrailingSlashURL(instanceUrl?: string) {
    return instanceUrl ? instanceUrl.replace(/\/+$/, '') : '';
  }

  public disconnect(): void {
    if (this.systemEventClient) {
      this.systemEventClient.disconnect();
    }
    if (this.userEventClient) {
      this.userEventClient.disconnect();
    }
  }

  public isReady(): boolean {
    return this.systemEventClient?.isConnected() && this.userEventClient?.isConnected() ? true : false;
  }
}
