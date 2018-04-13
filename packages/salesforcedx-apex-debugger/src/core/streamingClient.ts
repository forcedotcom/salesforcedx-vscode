/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Client as FayeClient } from 'faye';
import os = require('os');
import { RequestService } from '../commands';
import { DEFAULT_STREAMING_TIMEOUT_MS } from '../constants';
import { nls } from '../messages';

export enum ApexDebuggerEventType {
  ApexException,
  Debug,
  HeartBeat,
  LogLine,
  OrgChange,
  Ready,
  RequestStarted,
  RequestFinished,
  Resumed,
  SessionTerminated,
  Stopped,
  SystemInfo,
  SystemGack,
  SystemWarning
}

export interface StreamingEvent {
  createdDate: string;
  replayId: number;
  type: string;
}

export interface ApexDebuggerEvent {
  SessionId: string;
  RequestId?: string;
  BreakpointId?: string;
  Type: string;
  Description?: string;
  FileName?: string;
  Line?: number;
  Stacktrace?: string;
}

export interface DebuggerMessage {
  event: StreamingEvent;
  sobject: ApexDebuggerEvent;
}

export class StreamingClientInfo {
  public readonly channel: string;
  public readonly timeout: number;
  public readonly errorHandler: (reason: string) => void;
  public readonly connectedHandler: () => void;
  public readonly disconnectedHandler: () => void;
  public readonly messageHandler: (message: any) => void;

  public constructor(builder: StreamingClientInfoBuilder) {
    this.channel = builder.channel;
    this.timeout = builder.timeout;
    this.errorHandler = builder.errorHandler;
    this.connectedHandler = builder.connectedHandler;
    this.disconnectedHandler = builder.disconnectedHandler;
    this.messageHandler = builder.messageHandler;
  }
}

export class StreamingClientInfoBuilder {
  public channel: string;
  public timeout: number;
  public errorHandler: (reason: string) => void;
  public connectedHandler: () => void;
  public disconnectedHandler: () => void;
  public messageHandler: (message: any) => void;

  public forChannel(channel: string): StreamingClientInfoBuilder {
    this.channel = channel;
    return this;
  }

  public withTimeout(durationInSeconds: number): StreamingClientInfoBuilder {
    this.timeout = durationInSeconds || DEFAULT_STREAMING_TIMEOUT_MS;
    return this;
  }

  public withErrorHandler(
    handler: (reason: string) => void
  ): StreamingClientInfoBuilder {
    this.errorHandler = handler;
    return this;
  }

  public withConnectedHandler(handler: () => void): StreamingClientInfoBuilder {
    this.connectedHandler = handler;
    return this;
  }

  public withDisconnectedHandler(
    handler: () => void
  ): StreamingClientInfoBuilder {
    this.disconnectedHandler = handler;
    return this;
  }

  public withMsgHandler(
    handler: (message: any) => void
  ): StreamingClientInfoBuilder {
    this.messageHandler = handler;
    return this;
  }

  public build(): StreamingClientInfo {
    return new StreamingClientInfo(this);
  }
}

export class StreamingClient {
  private client: FayeClient;
  private connected = false;
  private shouldDisconnect = false;
  private isReplaySupported = false;
  private replayId = -1;
  private clientInfo: StreamingClientInfo;

  public constructor(
    url: string,
    requestService: RequestService,
    clientInfo: StreamingClientInfo
  ) {
    this.clientInfo = clientInfo;
    this.client = new FayeClient(url, {
      timeout: this.clientInfo.timeout,
      proxy: {
        origin: requestService.proxyUrl,
        auth: requestService.proxyAuthorization
      }
    });
    this.client.setHeader(
      'Authorization',
      `OAuth ${requestService.accessToken}`
    );
    this.client.setHeader('Content-Type', 'application/json');
  }

  public async subscribe(): Promise<void> {
    let subscribeAccept: () => void, subscribeReject: () => void;
    const returnPromise = new Promise<
      void
    >((resolve: () => void, reject: () => void) => {
      subscribeAccept = resolve;
      subscribeReject = reject;
    });

    this.client.on('transport:down', async () => {
      if (!this.connected) {
        this.clientInfo.errorHandler(
          nls.localize('streaming_handshake_timeout_text')
        );
        subscribeReject();
      }
    });
    this.client.addExtension({
      incoming: (message: any, callback: (message: any) => void) => {
        if (message.channel === '/meta/handshake') {
          if (message.successful === true) {
            if (message.ext && message.ext['replay'] === true) {
              this.isReplaySupported = true;
            }
            this.shouldDisconnect = false;
          } else {
            this.connected = false;
            this.clientInfo.errorHandler(
              `${nls.localize(
                'streaming_handshake_error_text'
              )}:${os.EOL}${JSON.stringify(message)}${os.EOL}`
            );
            subscribeReject();
          }
        } else if (
          message.channel === '/meta/connect' &&
          !this.shouldDisconnect
        ) {
          const wasConnected = this.connected;
          this.connected = message.successful;
          if (!wasConnected && this.connected) {
            this.clientInfo.connectedHandler();
            subscribeAccept();
          } else if (wasConnected && !this.connected) {
            this.clientInfo.disconnectedHandler();
            this.sendSubscribeRequest();
          }
        } else if (message.channel === '/meta/disconnect') {
          this.shouldDisconnect = true;
        }
        callback(message);
      },
      outgoing: (message: any, callback: (message: any) => void) => {
        if (message.channel === '/meta/subscribe' && this.isReplaySupported) {
          if (!message.ext) {
            message.ext = {};
          }
          const replayFrom: any = {};
          replayFrom[this.clientInfo.channel] = this.replayId;
          message.ext['replay'] = replayFrom;
        }
        callback(message);
      }
    });
    this.sendSubscribeRequest();
    return returnPromise;
  }

  private sendSubscribeRequest(): void {
    this.client.subscribe(
      this.clientInfo.channel,
      this.clientInfo.messageHandler
    );
  }

  public disconnect(): void {
    this.shouldDisconnect = true;
    if (this.client && this.connected) {
      this.client.disconnect();
      this.clientInfo.disconnectedHandler();
    }
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getReplayId(): number {
    return this.replayId;
  }

  public setReplayId(replayId: number) {
    this.replayId = replayId;
  }

  public getClientInfo(): StreamingClientInfo {
    return this.clientInfo;
  }
}
