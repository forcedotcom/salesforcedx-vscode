/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StreamingClient, StreamingClientInfo } from './streamingClient';

export class StreamingService {
  public static SYSTEM_EVENT_CHANNEL = '/systemTopic/ApexDebuggerSystemEvent';
  public static USER_EVENT_CHANNEL = '/systemTopic/ApexDebuggerEvent';
  public static DEFAULT_TIMEOUT = 14400;
  private static instance: StreamingService;
  private clients: StreamingClient[] = [];

  public static getInstance() {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  public getClients(): StreamingClient[] {
    return this.clients;
  }

  public async subscribe(
    projectPath: string,
    instanceUrl: string,
    accessToken: string,
    clientInfos: StreamingClientInfo[]
  ): Promise<boolean> {
    const apiVersion = '41.0';
    const urlElements = [instanceUrl, 'cometd', apiVersion];
    const streamUrl = urlElements.join('/');

    for (const clientInfo of clientInfos) {
      const streamingClient = new StreamingClient(
        streamUrl,
        accessToken,
        clientInfo
      );
      this.clients.push(streamingClient);
    }

    for (const client of this.clients) {
      await client.subscribe();
    }
    return Promise.resolve(this.isReady());
  }

  public disconnect(): void {
    for (const client of this.clients) {
      client.disconnect();
    }
    this.clients = [];
  }

  public isReady(): boolean {
    if (this.clients && this.clients.length > 0) {
      for (const client of this.clients) {
        if (!client.isConnected()) {
          return false;
        }
      }
      return true;
    }
    return false;
  }
}
