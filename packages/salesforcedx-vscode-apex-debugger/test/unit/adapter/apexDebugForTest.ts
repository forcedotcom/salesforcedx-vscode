/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DebugProtocol } from 'vscode-debugprotocol';
import {
  ApexDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexDebug';
import { SessionService } from '../../../src/core/sessionService';

export class ApexDebugForTest extends ApexDebug {
  private receivedResponse: DebugProtocol.Response;
  private receivedEvents: DebugProtocol.Event[];

  constructor(sessionService: SessionService, timeout?: number) {
    super();
    this.receivedEvents = new Array();
    this.mySessionService = sessionService;
  }

  public getResponse(): DebugProtocol.Response {
    return this.receivedResponse;
  }

  public getEvents(): DebugProtocol.Event[] {
    return this.receivedEvents;
  }

  public sendResponse(response: DebugProtocol.Response): void {
    if (this.receivedResponse) {
      throw new Error('Should not receive more than one response');
    }
    this.receivedResponse = response;
  }

  public sendEvent(event: DebugProtocol.Event): void {
    this.receivedEvents.push(event);
  }

  public initializeReq(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    super.initializeRequest(response, args);
  }

  public attachReq(
    response: DebugProtocol.AttachResponse,
    args: DebugProtocol.AttachRequestArguments
  ): void {
    super.attachRequest(response, args);
  }

  public async launchReq(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): Promise<void> {
    super.launchRequest(response, args);
  }

  public async disconnectReq(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): Promise<void> {
    super.disconnectRequest(response, args);
  }
}
