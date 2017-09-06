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
import { OrgInfo } from '../../../src/commands';
import {
  BreakpointService,
  SessionService,
  StreamingService
} from '../../../src/core';

export class ApexDebugForTest extends ApexDebug {
  private receivedResponses: DebugProtocol.Response[] = [];
  private receivedEvents: DebugProtocol.Event[] = [];

  constructor(
    sessionService: SessionService,
    streamingService: StreamingService,
    breakpointService: BreakpointService
  ) {
    super();
    this.mySessionService = sessionService;
    this.myStreamingService = streamingService;
    this.myBreakpointService = breakpointService;
  }

  public getResponse(index: number): DebugProtocol.Response {
    return this.receivedResponses[index];
  }

  public getResponses(): DebugProtocol.Response[] {
    return this.receivedResponses;
  }

  public getEvents(): DebugProtocol.Event[] {
    return this.receivedEvents;
  }

  public sendResponse(response: DebugProtocol.Response): void {
    this.receivedResponses.push(response);
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

  public async continueReq(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): Promise<void> {
    return super.continueRequest(response, args);
  }

  public async nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments
  ): Promise<void> {
    super.nextRequest(response, args);
  }

  public async stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments
  ): Promise<void> {
    super.stepInRequest(response, args);
  }

  public async stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments
  ): Promise<void> {
    super.stepOutRequest(response, args);
  }

  public threadsReq(response: DebugProtocol.ThreadsResponse): void {
    super.threadsRequest(response);
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

  public setOrgInfo(orgInfo: OrgInfo): void {
    this.orgInfo = orgInfo;
  }

  public addRequestThread(requestId: string): void {
    this.requestThreads.push(requestId);
  }

  public getRequestThreads(): string[] {
    return this.requestThreads;
  }
}
