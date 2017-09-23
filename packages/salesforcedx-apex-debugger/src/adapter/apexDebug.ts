/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename } from 'path';
import {
  DebugSession,
  Event,
  InitializedEvent,
  OutputEvent,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread,
  ThreadEvent
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import {
  LineBreakpointInfo,
  LineBreakpointsInTyperef
} from '../breakpoints/lineBreakpoint';
import {
  DebuggerResponse,
  ForceOrgDisplay,
  OrgInfo,
  RequestService,
  RunCommand,
  StateCommand,
  StepIntoCommand,
  StepOutCommand,
  StepOverCommand
} from '../commands';
import {
  GET_LINE_BREAKPOINT_INFO_EVENT,
  GET_PROXY_SETTINGS_EVENT,
  HOTSWAP_REQUEST,
  LINE_BREAKPOINT_INFO_REQUEST,
  PROXY_SETTINGS_REQUEST,
  SHOW_MESSAGE_EVENT
} from '../constants';
import {
  ApexDebuggerEventType,
  BreakpointService,
  DebuggerMessage,
  SessionService,
  StreamingClientInfo,
  StreamingClientInfoBuilder,
  StreamingService
} from '../core';
import {
  ProxySettings,
  VscodeDebuggerMessage,
  VscodeDebuggerMessageType
} from '../index';
import { nls } from '../messages';
import os = require('os');

export interface LaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  userIdFilter?: string;
  requestTypeFilter?: string;
  entryPointFilter?: string;
  sfdxProject: string;
}

export class ApexDebug extends DebugSession {
  protected mySessionService = SessionService.getInstance();
  protected myBreakpointService = BreakpointService.getInstance();
  protected myStreamingService = StreamingService.getInstance();
  protected myRequestService = RequestService.getInstance();
  protected sfdxProject: string;
  protected orgInfo: OrgInfo;
  protected requestThreads: Map<number, string>;
  protected threadId: number;

  private static TWO_NL = `${os.EOL}${os.EOL}`;
  private initializedResponse: DebugProtocol.InitializeResponse;

  constructor() {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerPathFormat('uri');
    this.requestThreads = new Map();
    this.threadId = 1;
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    this.myBreakpointService.clearSavedBreakpoints();
    this.initializedResponse = response;
    this.sendEvent(new Event(GET_PROXY_SETTINGS_EVENT));
    this.sendEvent(new Event(GET_LINE_BREAKPOINT_INFO_EVENT));
  }

  protected attachRequest(
    response: DebugProtocol.AttachResponse,
    args: DebugProtocol.AttachRequestArguments
  ): void {
    response.success = false;
    this.sendResponse(response);
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): Promise<void> {
    response.success = false;
    this.sfdxProject = args.sfdxProject;

    if (!this.myBreakpointService.hasLineNumberMapping()) {
      response.message = nls.localize('session_language_server_error_text');
      return this.sendResponse(response);
    }

    try {
      this.orgInfo = await new ForceOrgDisplay().getOrgInfo(args.sfdxProject);
      this.myRequestService.instanceUrl = this.orgInfo.instanceUrl;
      this.myRequestService.accessToken = this.orgInfo.accessToken;

      const isStreamingConnected = await this.connectStreaming(
        args.sfdxProject,
        this.orgInfo.instanceUrl,
        this.orgInfo.accessToken
      );
      if (!isStreamingConnected) {
        return this.sendResponse(response);
      }

      const sessionId = await this.mySessionService
        .forProject(args.sfdxProject)
        .withUserFilter(args.userIdFilter)
        .withEntryFilter(args.entryPointFilter)
        .withRequestFilter(args.requestTypeFilter)
        .start();
      if (this.mySessionService.isConnected()) {
        response.success = true;
        this.logToDebugConsole(nls.localize('session_started_text', sessionId));
        this.sendEvent(new InitializedEvent());
      } else {
        this.errorToDebugConsole(
          `${nls.localize('command_error_help_text')}:${os.EOL}${sessionId}`
        );
      }
    } catch (error) {
      this.tryToParseSfdxError(response, error);
    }

    this.sendResponse(response);
  }

  protected async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): Promise<void> {
    response.success = false;
    this.myStreamingService.disconnect();
    if (this.mySessionService.isConnected()) {
      try {
        const terminatedSessionId = await this.mySessionService.stop();
        if (!this.mySessionService.isConnected()) {
          response.success = true;
          this.logToDebugConsole(
            nls.localize('session_terminated_text', terminatedSessionId)
          );
        } else {
          this.errorToDebugConsole(
            `${nls.localize(
              'command_error_help_text'
            )}:${os.EOL}${terminatedSessionId}`
          );
        }
      } catch (error) {
        this.tryToParseSfdxError(response, error);
      }
    } else {
      response.success = true;
    }
    this.sendResponse(response);
  }

  protected async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): Promise<void> {
    if (args.source && args.source.path) {
      const processedBreakpoints: DebugProtocol.Breakpoint[] = [];
      const uri = this.convertClientPathToDebugger(args.source.path);

      try {
        const linesToSetBreakpoint = await this.myBreakpointService.reconcileBreakpoints(
          this.sfdxProject,
          this.mySessionService.getSessionId(),
          uri,
          args.lines
        );
        for (const existingBreakpoints of this.myBreakpointService.getBreakpointsFor(
          uri
        )) {
          processedBreakpoints.push({
            verified: true,
            source: args.source,
            line: existingBreakpoints
          });
        }

        for (const clientLine of linesToSetBreakpoint) {
          const serverLine = this.convertClientLineToDebugger(clientLine);
          const typeref = this.myBreakpointService.getTyperefFor(
            uri,
            serverLine
          );
          if (typeref) {
            const breakpointId = await this.myBreakpointService.createLineBreakpoint(
              this.sfdxProject,
              this.mySessionService.getSessionId(),
              typeref,
              serverLine
            );
            this.myBreakpointService.cacheBreakpoint(
              uri,
              clientLine,
              breakpointId
            );
            processedBreakpoints.push({
              verified: true,
              source: args.source,
              line: clientLine
            });
          } else {
            processedBreakpoints.push({
              verified: false,
              source: args.source,
              line: clientLine
            });
          }
        }

        response.success = true;
        response.body = {
          breakpoints: processedBreakpoints
        };
      } catch (error) {
        this.tryToParseSfdxError(response, error);
      }
    }
    this.sendResponse(response);
  }

  protected async continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): Promise<void> {
    response.success = false;
    response.body = { allThreadsContinued: false };
    if (this.requestThreads.has(args.threadId)) {
      const requestId = this.requestThreads.get(args.threadId)!;
      try {
        await this.myRequestService.execute(new RunCommand(requestId));
        response.success = true;
      } catch (error) {
        response.message = error;
      }
    }
    this.sendResponse(response);
  }

  protected async nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments
  ): Promise<void> {
    response.success = false;
    if (this.requestThreads.has(args.threadId)) {
      const requestId = this.requestThreads.get(args.threadId)!;
      try {
        await this.myRequestService.execute(new StepOverCommand(requestId));
        response.success = true;
      } catch (error) {
        response.message = error;
      }
    }
    this.sendResponse(response);
  }

  protected async stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments
  ): Promise<void> {
    response.success = false;
    if (this.requestThreads.has(args.threadId)) {
      const requestId = this.requestThreads.get(args.threadId)!;
      try {
        await this.myRequestService.execute(new StepIntoCommand(requestId));
        response.success = true;
      } catch (error) {
        response.message = error;
      }
    }
    this.sendResponse(response);
  }

  protected async stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments
  ): Promise<void> {
    response.success = false;
    if (this.requestThreads.has(args.threadId)) {
      const requestId = this.requestThreads.get(args.threadId)!;
      try {
        await this.myRequestService.execute(new StepOutCommand(requestId));
        response.success = true;
      } catch (error) {
        response.message = error;
      }
    }
    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    const debuggedThreads: Thread[] = [];
    for (const threadId of this.requestThreads.keys()) {
      debuggedThreads.push(
        new Thread(threadId, `Request ID: ${this.requestThreads.get(threadId)}`)
      );
    }
    response.success = true;
    response.body = { threads: debuggedThreads };
    this.sendResponse(response);
  }

  protected async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ): Promise<void> {
    response.success = false;
    if (!this.requestThreads.has(args.threadId)) {
      return this.sendResponse(response);
    }

    const requestId = this.requestThreads.get(args.threadId)!;
    try {
      const stateResponse = await this.myRequestService.execute(
        new StateCommand(requestId)
      );
      const stateRespObj: DebuggerResponse = JSON.parse(stateResponse);
      const clientFrames: StackFrame[] = [];
      if (this.hasStackFrames(stateRespObj)) {
        const serverFrames = stateRespObj.stateResponse.state.stack.stackFrame;
        for (let i = 0; i < serverFrames.length; i++) {
          const sourcePath = this.myBreakpointService.getSourcePathFromTyperef(
            serverFrames[i].typeRef
          );
          clientFrames.push(
            new StackFrame(
              i,
              serverFrames[i].fullName,
              sourcePath
                ? new Source(
                    basename(sourcePath),
                    this.convertDebuggerPathToClient(sourcePath)
                  )
                : undefined,
              this.convertDebuggerLineToClient(serverFrames[i].lineNumber),
              0
            )
          );
        }
      }
      response.body = { stackFrames: clientFrames };
      response.success = true;
    } catch (error) {
      response.message = error;
    }
    this.sendResponse(response);
  }

  private hasStackFrames(response: DebuggerResponse): boolean {
    if (
      response &&
      response.stateResponse &&
      response.stateResponse.state &&
      response.stateResponse.state.stack &&
      response.stateResponse.state.stack.stackFrame &&
      response.stateResponse.state.stack.stackFrame.length > 0
    ) {
      return true;
    }
    return false;
  }

  protected customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any
  ): void {
    switch (command) {
      case LINE_BREAKPOINT_INFO_REQUEST:
        const lineBpInfo: LineBreakpointInfo[] = args;
        if (lineBpInfo && lineBpInfo.length > 0) {
          const lineNumberMapping: Map<
            string,
            LineBreakpointsInTyperef[]
          > = new Map();
          const typerefMapping: Map<string, string> = new Map();
          for (const info of lineBpInfo) {
            if (!lineNumberMapping.has(info.uri)) {
              lineNumberMapping.set(info.uri, []);
            }
            const validLines: LineBreakpointsInTyperef = {
              typeref: info.typeref,
              lines: info.lines
            };
            lineNumberMapping.get(info.uri)!.push(validLines);
            typerefMapping.set(info.typeref, info.uri);
          }
          this.myBreakpointService.setValidLines(
            lineNumberMapping,
            typerefMapping
          );
        }
        this.initializedResponse.body = {
          supportsDelayedStackTraceLoading: false
        };
        this.initializedResponse.success = true;
        this.sendResponse(this.initializedResponse);
        break;
      case HOTSWAP_REQUEST:
        this.warnToDebugConsole(nls.localize('hotswap_warn_text'));
        break;
      case PROXY_SETTINGS_REQUEST:
        const proxySettings: ProxySettings = args;
        this.myRequestService.proxyUrl = proxySettings.url;
        this.myRequestService.proxyStrictSSL = proxySettings.strictSSL;
        this.myRequestService.proxyAuthorization = proxySettings.auth;
        break;
      default:
        break;
    }
    response.success = true;
    this.sendResponse(response);
  }

  private logToDebugConsole(
    msg?: string,
    sourceFile?: Source,
    sourceLine?: number
  ): void {
    if (msg && msg.length !== 0) {
      const event: DebugProtocol.OutputEvent = new OutputEvent(
        `${msg}${ApexDebug.TWO_NL}`,
        'stdout'
      );
      event.body.source = sourceFile;
      event.body.line = sourceLine;
      event.body.column = 0;
      this.sendEvent(event);
    }
  }

  private warnToDebugConsole(msg?: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(new OutputEvent(`${msg}${ApexDebug.TWO_NL}`, 'console'));
    }
  }

  private errorToDebugConsole(msg?: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(new OutputEvent(`${msg}${ApexDebug.TWO_NL}`, 'stderr'));
    }
  }

  public tryToParseSfdxError(
    response: DebugProtocol.Response,
    error?: any
  ): void {
    if (!error) {
      return;
    }
    try {
      response.success = false;
      const errorObj = JSON.parse(error);
      if (errorObj && errorObj.message) {
        const errorMessage: string = errorObj.message;
        if (
          errorMessage.includes(
            'entity type cannot be inserted: Apex Debugger Session'
          )
        ) {
          response.message = nls.localize('session_no_entity_access_text');
        } else {
          response.message = errorMessage;
        }
        if (errorObj.action) {
          this.errorToDebugConsole(
            `${nls.localize(
              'command_error_help_text'
            )}:${os.EOL}${errorObj.action}`
          );
        }
      } else {
        this.errorToDebugConsole(
          `${nls.localize('command_error_help_text')}:${os.EOL}${error}`
        );
      }
    } catch (e) {
      this.errorToDebugConsole(
        `${nls.localize('command_error_help_text')}:${os.EOL}${error}`
      );
    }
  }

  public async connectStreaming(
    projectPath: string,
    instanceUrl: string,
    accessToken: string
  ): Promise<boolean> {
    const clientInfos: StreamingClientInfo[] = [];
    for (const channel of [
      StreamingService.SYSTEM_EVENT_CHANNEL,
      StreamingService.USER_EVENT_CHANNEL
    ]) {
      const clientInfo = new StreamingClientInfoBuilder()
        .forChannel(channel)
        .withConnectedHandler(() => {
          this.logToDebugConsole(
            nls.localize('streaming_connected_text', channel)
          );
        })
        .withDisconnectedHandler(() => {
          this.logToDebugConsole(
            nls.localize('streaming_disconnected_text', channel)
          );
        })
        .withErrorHandler((reason: string) => {
          this.errorToDebugConsole(reason);
        })
        .withMsgHandler((message: any) => {
          const data = message as DebuggerMessage;
          if (data && data.sobject && data.event) {
            this.handleEvent(data);
          }
        })
        .build();
      clientInfos.push(clientInfo);
    }
    const systemChannelInfo = clientInfos[0];
    const userChannelInfo = clientInfos[1];

    return this.myStreamingService.subscribe(
      projectPath,
      instanceUrl,
      accessToken,
      systemChannelInfo,
      userChannelInfo
    );
  }

  public handleEvent(message: DebuggerMessage): void {
    const type: ApexDebuggerEventType = (<any>ApexDebuggerEventType)[
      message.sobject.Type
    ];
    if (
      !this.mySessionService.isConnected() ||
      this.mySessionService.getSessionId() !== message.sobject.SessionId ||
      this.myStreamingService.hasProcessedEvent(type, message.event.replayId)
    ) {
      return;
    }
    switch (type) {
      case ApexDebuggerEventType.ApexException: {
        this.handleApexException(message);
        break;
      }
      case ApexDebuggerEventType.Debug: {
        this.handleDebug(message);
        break;
      }
      case ApexDebuggerEventType.RequestFinished: {
        this.handleRequestFinished(message);
        break;
      }
      case ApexDebuggerEventType.RequestStarted: {
        this.handleRequestStarted(message);
        break;
      }
      case ApexDebuggerEventType.Resumed: {
        this.handleResumed(message);
        break;
      }
      case ApexDebuggerEventType.SessionTerminated: {
        this.handleSessionTerminated(message);
        break;
      }
      case ApexDebuggerEventType.Stopped: {
        this.handleStopped(message);
        break;
      }
      case ApexDebuggerEventType.SystemGack: {
        this.handleSystemGack(message);
        break;
      }
      case ApexDebuggerEventType.SystemInfo: {
        this.handleSystemInfo(message);
        break;
      }
      case ApexDebuggerEventType.SystemWarning: {
        this.handleSystemWarning(message);
        break;
      }
      case ApexDebuggerEventType.LogLine:
      case ApexDebuggerEventType.OrgChange:
      case ApexDebuggerEventType.Ready:
      default: {
        break;
      }
    }
    this.myStreamingService.markEventProcessed(type, message.event.replayId);
  }

  public logEvent(message: DebuggerMessage): void {
    let eventDescriptionSourceFile: Source | undefined;
    let eventDescriptionSourceLine: number | undefined;
    let logMessage =
      message.event.createdDate === null
        ? new Date().toUTCString()
        : message.event.createdDate;
    logMessage += ` | ${message.sobject.Type}`;
    if (message.sobject.RequestId) {
      logMessage += ` | Request: ${message.sobject.RequestId}`;
    }
    if (message.sobject.BreakpointId) {
      logMessage += ` | Breakpoint: ${message.sobject.BreakpointId}`;
    }
    if (message.sobject.Line) {
      logMessage += ` | Line: ${message.sobject.Line}`;
    }
    if (message.sobject.Description) {
      logMessage += ` | ${message.sobject.Description}`;
      const regExp: RegExp = /^(.*)\[(\d+)\]\|/;
      const matches = message.sobject.Description.match(regExp);
      if (matches && matches.length === 3) {
        const possibleClassName = matches[1];
        const possibleClassLine = parseInt(matches[2]);
        const possibleSourcePath = this.myBreakpointService.getSourcePathFromPartialTyperef(
          possibleClassName
        );
        if (possibleSourcePath) {
          eventDescriptionSourceFile = new Source(
            basename(possibleSourcePath),
            this.convertDebuggerPathToClient(possibleSourcePath)
          );
          eventDescriptionSourceLine = this.convertDebuggerLineToClient(
            possibleClassLine
          );
        }
      }
    }
    if (message.sobject.Stacktrace) {
      logMessage += ` |${os.EOL}${message.sobject.Stacktrace}`;
    }

    this.logToDebugConsole(
      logMessage,
      eventDescriptionSourceFile,
      eventDescriptionSourceLine
    );
  }

  private getThreadIdFromRequestId(
    requestId: string | undefined
  ): number | undefined {
    for (const threadId of this.requestThreads.keys()) {
      if (this.requestThreads.get(threadId) === requestId) {
        return threadId;
      }
    }
  }

  private handleApexException(message: DebuggerMessage): void {
    this.logEvent(message);
  }

  private handleDebug(message: DebuggerMessage): void {
    this.logEvent(message);
  }

  private handleRequestFinished(message: DebuggerMessage): void {
    const threadId = this.getThreadIdFromRequestId(message.sobject.RequestId);
    if (threadId !== undefined) {
      this.logEvent(message);
      this.requestThreads.delete(threadId);
      this.sendEvent(new ThreadEvent('exited', threadId));
    }
  }

  private handleRequestStarted(message: DebuggerMessage): void {
    if (message.sobject.RequestId) {
      this.logEvent(message);
      this.requestThreads.set(this.threadId++, message.sobject.RequestId);
    }
  }

  private handleResumed(message: DebuggerMessage): void {
    const threadId = this.getThreadIdFromRequestId(message.sobject.RequestId);
    if (threadId !== undefined) {
      this.logEvent(message);
    }
  }

  private handleSessionTerminated(message: DebuggerMessage): void {
    if (message.sobject.Description) {
      this.errorToDebugConsole(message.sobject.Description);
      this.sendEvent(
        new Event(SHOW_MESSAGE_EVENT, {
          type: VscodeDebuggerMessageType.Error,
          message: message.sobject.Description
        } as VscodeDebuggerMessage)
      );
    }
    this.mySessionService.forceStop();
    this.sendEvent(new TerminatedEvent());
  }

  private handleStopped(message: DebuggerMessage): void {
    const threadId = this.getThreadIdFromRequestId(message.sobject.RequestId);
    if (threadId !== undefined) {
      this.logEvent(message);
      const stoppedEvent: DebugProtocol.StoppedEvent = new StoppedEvent(
        message.sobject.BreakpointId ? 'breakpoint' : 'step',
        threadId
      );
      this.sendEvent(stoppedEvent);
    }
  }

  private handleSystemGack(message: DebuggerMessage): void {
    this.logEvent(message);
    if (message.sobject.Description) {
      this.sendEvent(
        new Event(SHOW_MESSAGE_EVENT, {
          type: VscodeDebuggerMessageType.Error,
          message: message.sobject.Description
        } as VscodeDebuggerMessage)
      );
    }
  }

  private handleSystemInfo(message: DebuggerMessage): void {
    this.logEvent(message);
  }

  private handleSystemWarning(message: DebuggerMessage): void {
    this.logEvent(message);
    if (message.sobject.Description) {
      this.sendEvent(
        new Event(SHOW_MESSAGE_EVENT, {
          type: VscodeDebuggerMessageType.Warning,
          message: message.sobject.Description
        } as VscodeDebuggerMessage)
      );
    }
  }
}

DebugSession.run(ApexDebug);
