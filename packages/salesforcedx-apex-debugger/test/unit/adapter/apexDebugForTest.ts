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
import {
  BreakpointService,
  SessionService,
  StreamingService
} from '../../../src/core';

export class ApexDebugForTest extends ApexDebug {
  private receivedResponse: DebugProtocol.Response;
  private receivedEvents: DebugProtocol.Event[];

  constructor(
    sessionService: SessionService,
    streamingService: StreamingService,
    breakpointService: BreakpointService
  ) {
    super();
    this.receivedEvents = new Array();
    this.mySessionService = sessionService;
    this.myStreamingService = streamingService;
    this.myBreakpointService = breakpointService;
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
    return super.launchRequest(response, args);
  }

  public async disconnectReq(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): Promise<void> {
    return super.disconnectRequest(response, args);
  }

  public async setBreakPointsReq(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): Promise<void> {
    return super.setBreakPointsRequest(response, args);
  }

  public customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any
  ): void {
    return super.customRequest(command, response, args);
  }

  public setSfdxProject(projectPath: string): void {
    this.sfdxProject = projectPath;
  }
}
