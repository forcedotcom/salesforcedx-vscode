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
  Handles,
  InitializedEvent,
  logger,
  Logger,
  LoggingDebugSession,
  OutputEvent,
  Scope,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread,
  ThreadEvent,
  Variable
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import {
  LineBreakpointInfo,
  LineBreakpointsInTyperef
} from '../breakpoints/lineBreakpoint';
import {
  DebuggerResponse,
  ForceOrgDisplay,
  FrameCommand,
  LocalValue,
  OrgInfo,
  Reference,
  ReferencesCommand,
  RunCommand,
  StateCommand,
  StepIntoCommand,
  StepOutCommand,
  StepOverCommand,
  Tuple,
  Value
} from '../commands';
import {
  GET_LINE_BREAKPOINT_INFO_EVENT,
  HOTSWAP_REQUEST,
  LINE_BREAKPOINT_INFO_REQUEST,
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
import { VscodeDebuggerMessage, VscodeDebuggerMessageType } from '../index';
import { nls } from '../messages';
import os = require('os');

const TRACE_ALL = 'all';
const TRACE_CATEGORY_VARIABLES = 'variables';
const TRACE_CATEGORY_LAUNCH = 'launch';
const TRACE_CATEGORY_PROTOCOL = 'protocol';

export type TraceCategory = 'all' | 'variables' | 'launch' | 'protocol';

export interface LaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  /** comma separated list of trace selectors (see TraceCategory)
	  */
  trace?: boolean | string;
  userIdFilter?: string;
  requestTypeFilter?: string;
  entryPointFilter?: string;
  sfdxProject: string;
}

export class ApexDebugStackFrameInfo {
  public readonly requestId: string;
  public readonly frameNumber: number;
  public globals: Value[];
  public statics: Value[];
  public locals: LocalValue[];
  public references: Reference[];
  constructor(requestId: string, frameNumber: number) {
    this.requestId = requestId;
    this.frameNumber = frameNumber;
  }
}

export enum ApexVariableKind {
  Global = 10,
  Static = 20,
  Local = 30,
  Field = 40,
  Collection = 50
}

export class ApexVariable extends Variable {
  public readonly declaredTypeRef: string;
  private readonly slot: number;
  private readonly kind: ApexVariableKind;

  constructor(
    value: Value,
    kind: ApexVariableKind,
    variableReference?: number
  ) {
    super(value.name, ApexVariable.valueAsString(value), variableReference);
    this.declaredTypeRef = value.declaredTypeRef;
    this.kind = kind;
    if ((value as LocalValue).slot !== undefined) {
      this.slot = (value as LocalValue).slot;
    } else {
      this.slot = Number.MAX_SAFE_INTEGER;
    }
  }

  public static valueAsString(value: Value): string {
    if (typeof value.value === 'undefined' || value.value === null) {
      // We want to explicitly display null for null values (no type info for strings).
      return ApexVariable.isString(value)
        ? 'null'
        : `null [${value.nameForMessages}]`;
    }

    if (ApexVariable.isString(value)) {
      // We want to explicitly quote string values like in Java. This allows us to differentiate null from 'null'.
      return `'${value.value}'`;
    }

    return `${value.value} [${value.nameForMessages}]`;
  }

  public static compareVariables(v1: ApexVariable, v2: ApexVariable): number {
    // group by kind
    if (v1.kind !== v2.kind) {
      return v1.kind - v2.kind;
    }

    // use slots when available
    if (ApexVariable.isLocalOrField(v1)) {
      return v1.slot - v2.slot;
    }

    // compare names
    let n1 = v1.name;
    let n2 = v2.name;

    // convert [n], [n..m] -> n
    n1 = ApexVariable.extractNumber(n1);
    n2 = ApexVariable.extractNumber(n2);

    const i1 = parseInt(n1);
    const i2 = parseInt(n2);
    const isNum1 = !isNaN(i1);
    const isNum2 = !isNaN(i2);

    if (isNum1 && !isNum2) {
      return 1; // numbers after names
    }
    if (!isNum1 && isNum2) {
      return -1; // names before numbers
    }
    if (isNum1 && isNum2) {
      return i1 - i2;
    }
    return n1.localeCompare(n2);
  }

  private static extractNumber(s: string): string {
    if (s[0] === '[' && s[s.length - 1] === ']') {
      return s.substring(1, s.length - 1);
    }
    return s;
  }

  private static isLocalOrField(v1: ApexVariable) {
    return (
      v1.kind === ApexVariableKind.Local || v1.kind === ApexVariableKind.Field
    );
  }

  private static isString(value: Value) {
    return value.declaredTypeRef === 'java/lang/String';
  }
}

export type FilterType = 'named' | 'indexed' | 'all';

export interface VariableContainer {
  expand(
    session: ApexDebug,
    filter: FilterType,
    start: number | undefined,
    count: number | undefined
  ): Promise<ApexVariable[]>;
}

export type ScopeType = 'local' | 'static' | 'global';

export class ScopeContainer implements VariableContainer {
  private type: ScopeType;
  private frameInfo: ApexDebugStackFrameInfo;

  public constructor(type: ScopeType, frameInfo: ApexDebugStackFrameInfo) {
    this.type = type;
    this.frameInfo = frameInfo;
  }

  public async expand(
    session: ApexDebug,
    filter: FilterType,
    start: number,
    count: number
  ): Promise<ApexVariable[]> {
    if (
      !this.frameInfo.locals &&
      !this.frameInfo.statics &&
      !this.frameInfo.globals
    ) {
      await session.fetchFrameVariables(this.frameInfo);
    }

    let values: Value[] = [];
    let variableKind: ApexVariableKind;
    switch (this.type) {
      case 'local':
        values = this.frameInfo.locals ? this.frameInfo.locals : [];
        variableKind = ApexVariableKind.Local;
        break;
      case 'static':
        values = this.frameInfo.statics ? this.frameInfo.statics : [];
        variableKind = ApexVariableKind.Static;
        break;
      case 'global':
        values = this.frameInfo.globals ? this.frameInfo.globals : [];
        variableKind = ApexVariableKind.Global;
        break;
      default:
        return [];
    }

    return Promise.all(
      values.map(async value => {
        const variableReference = await session.resolveApexIdToVariableReference(
          this.frameInfo.requestId,
          value.ref
        );
        return new ApexVariable(value, variableKind, variableReference);
      })
    );
  }
}

export class ObjectReferenceContainer implements VariableContainer {
  protected reference: Reference;
  protected requestId: string;

  public constructor(reference: Reference, requestId: string) {
    this.reference = reference;
    this.requestId = requestId;
  }

  public async expand(
    session: ApexDebug,
    filter: FilterType,
    start: number,
    count: number
  ): Promise<ApexVariable[]> {
    if (!this.reference.fields) {
      // this object is empty
      return [];
    }

    return Promise.all(
      this.reference.fields.map(async value => {
        const variableReference = await session.resolveApexIdToVariableReference(
          this.requestId,
          value.ref
        );
        return new ApexVariable(
          value,
          ApexVariableKind.Field,
          variableReference
        );
      })
    );
  }
}

export class CollectionReferenceContainer extends ObjectReferenceContainer {
  public async expand(
    session: ApexDebug,
    filter: FilterType,
    start: number,
    count: number
  ): Promise<ApexVariable[]> {
    if (!this.reference.value) {
      // this object is empty
      return [];
    }

    return Promise.all(
      this.reference.value.map(async value => {
        const variableReference = await session.resolveApexIdToVariableReference(
          this.requestId,
          value.ref
        );
        return new ApexVariable(
          value,
          ApexVariableKind.Collection,
          variableReference
        );
      })
    );
  }
}

export class MapReferenceContainer extends ObjectReferenceContainer {
  private readonly tupleContainers: Map<number, MapTupleContainer> = new Map();

  public addTupleContainer(
    reference: number,
    tupleContainer: MapTupleContainer
  ): void {
    this.tupleContainers.set(reference, tupleContainer);
  }

  public async expand(
    session: ApexDebug,
    filter: FilterType,
    start: number,
    count: number
  ): Promise<ApexVariable[]> {
    const result: ApexVariable[] = [];
    this.tupleContainers.forEach((container, reference) => {
      result.push(
        new ApexVariable(
          {
            name: container.keyAsString(),
            declaredTypeRef: '',
            nameForMessages: container.keyAsString(),
            value: container.valueAsString()
          },
          ApexVariableKind.Collection,
          reference
        )
      );
    });

    return result;
  }
}

export class MapTupleContainer implements VariableContainer {
  private tuple: Tuple;
  private requestId: string;

  public constructor(tuple: Tuple, requestId: string) {
    this.tuple = tuple;
    this.requestId = requestId;
  }

  public keyAsString(): string {
    return ApexVariable.valueAsString(this.tuple.key);
  }

  public valueAsString(): string {
    return ApexVariable.valueAsString(this.tuple.value);
  }

  public async expand(
    session: ApexDebug,
    filter: FilterType,
    start: number,
    count: number
  ): Promise<ApexVariable[]> {
    if (!this.tuple.key && !this.tuple.value) {
      // this object is empty
      return [];
    }

    const idsToFetch = [];
    if (this.tuple.key && this.tuple.key.ref) {
      idsToFetch.push(this.tuple.key.ref);
    }
    if (this.tuple.value && this.tuple.value.ref) {
      idsToFetch.push(this.tuple.value.ref);
    }
    await session.fetchReferencesIfNecessary(this.requestId, idsToFetch);

    const variables = [];
    if (this.tuple.key) {
      const keyVariableReference = this.tuple.key.ref
        ? await session.resolveApexIdToVariableReference(
            this.requestId,
            this.tuple.key.ref
          )
        : undefined;
      variables.push(
        new ApexVariable(
          this.tuple.key,
          ApexVariableKind.Collection,
          keyVariableReference
        )
      );
    }
    if (this.tuple.value) {
      const valueVariableReference = this.tuple.value.ref
        ? await session.resolveApexIdToVariableReference(
            this.requestId,
            this.tuple.value.ref
          )
        : undefined;
      variables.push(
        new ApexVariable(
          this.tuple.value,
          ApexVariableKind.Collection,
          valueVariableReference
        )
      );
    }

    return variables;
  }
}

export class ApexDebug extends LoggingDebugSession {
  protected mySessionService = SessionService.getInstance();
  protected myBreakpointService = BreakpointService.getInstance();
  protected myStreamingService = StreamingService.getInstance();
  protected sfdxProject: string;
  protected orgInfo: OrgInfo;
  protected requestThreads: Map<number, string>;
  protected threadId: number;

  private stackFrameInfos = new Handles<ApexDebugStackFrameInfo>();
  private variableHandles = new Handles<VariableContainer>();
  private variableContainerReferenceByApexId = new Map<number, number>();

  private static LINEBREAK = `${os.EOL}`;
  private initializedResponse: DebugProtocol.InitializeResponse;

  private trace: string[] | undefined;
  private traceAll = false;

  constructor() {
    super('apex-debug-adapter.log');
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
    if (typeof args.trace === 'boolean') {
      this.trace = args.trace ? [TRACE_ALL] : undefined;
      this.traceAll = args.trace;
    } else if (typeof args.trace === 'string') {
      this.trace = args.trace.split(',');
      this.traceAll = this.trace.indexOf(TRACE_ALL) >= 0;
    }
    if (this.trace && this.trace.indexOf(TRACE_CATEGORY_PROTOCOL) >= 0) {
      // only log debug adapter protocol if 'protocol' tracing flag is set, ignore traceAll here
      logger.setup(Logger.LogLevel.Verbose, /*logToFile=*/ false);
    } else {
      logger.setup(Logger.LogLevel.Stop, false);
    }

    response.success = false;
    this.sfdxProject = args.sfdxProject;

    if (!this.myBreakpointService.hasLineNumberMapping()) {
      response.message = nls.localize('session_language_server_error_text');
      return this.sendResponse(response);
    }

    try {
      this.orgInfo = await new ForceOrgDisplay().getOrgInfo(args.sfdxProject);
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
        this.printToDebugConsole(
          nls.localize('session_started_text', sessionId)
        );
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
          this.printToDebugConsole(
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
        response.body = { breakpoints: processedBreakpoints };
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
        await new RunCommand(
          this.orgInfo.instanceUrl,
          this.orgInfo.accessToken,
          requestId
        ).execute();
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
        await new StepOverCommand(
          this.orgInfo.instanceUrl,
          this.orgInfo.accessToken,
          requestId
        ).execute();
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
        await new StepIntoCommand(
          this.orgInfo.instanceUrl,
          this.orgInfo.accessToken,
          requestId
        ).execute();
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
        await new StepOutCommand(
          this.orgInfo.instanceUrl,
          this.orgInfo.accessToken,
          requestId
        ).execute();
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
      const stateResponse = await new StateCommand(
        this.orgInfo.instanceUrl,
        this.orgInfo.accessToken,
        requestId
      ).execute();
      const stateRespObj: DebuggerResponse = JSON.parse(stateResponse);
      const clientFrames: StackFrame[] = [];
      if (this.hasStackFrames(stateRespObj)) {
        const serverFrames = stateRespObj.stateResponse.state.stack.stackFrame;
        for (let i = 0; i < serverFrames.length; i++) {
          const sourcePath = this.myBreakpointService.getSourcePathFromTyperef(
            serverFrames[i].typeRef
          );
          const frameInfo = new ApexDebugStackFrameInfo(
            requestId,
            serverFrames[i].frameNumber
          );
          const frameId = this.stackFrameInfos.create(frameInfo);
          if (i === 0 && stateRespObj.stateResponse.state) {
            // populate first stack frame with info from state response (saves a server round trip)
            this.log(
              TRACE_CATEGORY_VARIABLES,
              'stackTraceRequest: state=' +
                JSON.stringify(stateRespObj.stateResponse.state)
            );
            if (
              stateRespObj.stateResponse.state.locals &&
              stateRespObj.stateResponse.state.locals.local
            ) {
              frameInfo.locals = stateRespObj.stateResponse.state.locals.local;
            } else {
              frameInfo.locals = [];
            }

            if (
              stateRespObj.stateResponse.state.statics &&
              stateRespObj.stateResponse.state.statics.static
            ) {
              frameInfo.statics =
                stateRespObj.stateResponse.state.statics.static;
            } else {
              frameInfo.statics = [];
            }

            if (
              stateRespObj.stateResponse.state.globals &&
              stateRespObj.stateResponse.state.globals.global
            ) {
              frameInfo.globals =
                stateRespObj.stateResponse.state.globals.global;
            } else {
              frameInfo.globals = [];
            }

            if (
              stateRespObj.stateResponse.state.references &&
              stateRespObj.stateResponse.state.references.references
            ) {
              this.populateReferences(
                stateRespObj.stateResponse.state.references.references,
                frameInfo.requestId
              );
            }
          }

          clientFrames.push(
            new StackFrame(
              frameId,
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
      default:
        break;
    }
    response.success = true;
    this.sendResponse(response);
  }

  protected async scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments
  ): Promise<void> {
    const frameInfo = this.stackFrameInfos.get(args.frameId);
    if (!frameInfo) {
      this.log(
        TRACE_CATEGORY_VARIABLES,
        `scopesRequest: no frame info found for stack frame ${args.frameId}`
      );
      response.body = { scopes: [] };
      this.sendResponse(response);
      return;
    }

    const scopes = new Array<Scope>();
    scopes.push(
      new Scope(
        'Local',
        this.variableHandles.create(new ScopeContainer('local', frameInfo)),
        false
      )
    );
    scopes.push(
      new Scope(
        'Static',
        this.variableHandles.create(new ScopeContainer('static', frameInfo)),
        false
      )
    );
    scopes.push(
      new Scope(
        'Global',
        this.variableHandles.create(new ScopeContainer('global', frameInfo)),
        true
      )
    );

    response.body = { scopes: scopes };
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ): Promise<void> {
    const variablesContainer = this.variableHandles.get(
      args.variablesReference
    );
    if (!variablesContainer) {
      this.log(
        TRACE_CATEGORY_VARIABLES,
        `variablesRequest: no container for variablesReference=${args.variablesReference}`
      );
      // no container found: return empty variables array
      response.body = { variables: [] };
      this.sendResponse(response);
      return;
    }

    const filter: FilterType =
      args.filter === 'indexed' || args.filter === 'named'
        ? args.filter
        : 'all';
    variablesContainer
      .expand(this, filter, args.start, args.count)
      .then(variables => {
        variables.sort(ApexVariable.compareVariables);
        response.body = { variables: variables };
        this.sendResponse(response);
      })
      .catch(err => {
        this.log(
          TRACE_CATEGORY_VARIABLES,
          `variablesRequest: error reading variables ${err} ${err.stack}`
        );
        // in case of error return empty variables array
        response.body = { variables: [] };
        this.sendResponse(response);
      });
  }

  public async fetchFrameVariables(
    frameInfo: ApexDebugStackFrameInfo
  ): Promise<void> {
    const frameResponse = await new FrameCommand(
      this.orgInfo.instanceUrl,
      this.orgInfo.accessToken,
      frameInfo.requestId,
      frameInfo.frameNumber
    ).execute();
    const frameRespObj: DebuggerResponse = JSON.parse(frameResponse);
    if (
      frameRespObj &&
      frameRespObj.frameResponse &&
      frameRespObj.frameResponse.frame
    ) {
      this.log(
        TRACE_CATEGORY_VARIABLES,
        `fetchFrameVariables: frame ${frameInfo.frameNumber} frame=` +
          JSON.stringify(frameRespObj.frameResponse.frame)
      );
      if (
        frameRespObj.frameResponse.frame.locals &&
        frameRespObj.frameResponse.frame.locals.local
      ) {
        frameInfo.locals = frameRespObj.frameResponse.frame.locals.local;
      } else {
        frameInfo.locals = [];
      }

      if (
        frameRespObj.frameResponse.frame.statics &&
        frameRespObj.frameResponse.frame.statics.static
      ) {
        frameInfo.statics = frameRespObj.frameResponse.frame.statics.static;
      } else {
        frameInfo.statics = [];
      }

      if (
        frameRespObj.frameResponse.frame.globals &&
        frameRespObj.frameResponse.frame.globals.global
      ) {
        frameInfo.globals = frameRespObj.frameResponse.frame.globals.global;
      } else {
        frameInfo.globals = [];
      }

      if (
        frameRespObj.frameResponse.frame.references &&
        frameRespObj.frameResponse.frame.references.references
      ) {
        this.populateReferences(
          frameRespObj.frameResponse.frame.references.references,
          frameInfo.requestId
        );
      }
    }
  }

  protected populateReferences(
    references: Reference[],
    requestId: string
  ): void {
    references.map(reference => {
      let variableReference: number;
      if (reference.type === 'object') {
        variableReference = this.variableHandles.create(
          new ObjectReferenceContainer(reference, requestId)
        );
        this.log(
          TRACE_CATEGORY_VARIABLES,
          `populateReferences: new object reference: ${variableReference} for ${reference.id} ${reference.nameForMessages}`
        );
      } else if (reference.type === 'list' || reference.type === 'set') {
        variableReference = this.variableHandles.create(
          new CollectionReferenceContainer(reference, requestId)
        );
        this.log(
          TRACE_CATEGORY_VARIABLES,
          `populateReferences: new ${reference.type} reference: ${variableReference} for ${reference.id} ${reference.nameForMessages}`
        );
      } else if (reference.type === 'map') {
        const mapContainer = new MapReferenceContainer(reference, requestId);
        // explode all map entried so that we can drill down a map logically
        if (reference.tuple) {
          reference.tuple.forEach(tuple => {
            const tupleContainer = new MapTupleContainer(tuple, requestId);
            const tupleReference = this.variableHandles.create(tupleContainer);
            mapContainer.addTupleContainer(tupleReference, tupleContainer);
          });
        }
        variableReference = this.variableHandles.create(mapContainer);
        this.log(
          TRACE_CATEGORY_VARIABLES,
          `populateReferences: new map reference: ${variableReference} for ${reference.id} ${reference.nameForMessages}`
        );
      } else {
        const referenceInfo = JSON.stringify(reference);
        this.log(
          TRACE_CATEGORY_VARIABLES,
          `populateReferences: unhandled reference: ${referenceInfo}`
        );
        return;
      }

      // map apex id to container reference
      this.variableContainerReferenceByApexId.set(
        reference.id,
        variableReference
      );
    });
  }

  public async resolveApexIdToVariableReference(
    requestId: string,
    apexId: number | undefined
  ): Promise<number | undefined> {
    if (typeof apexId === 'undefined') {
      return;
    }
    if (!this.variableContainerReferenceByApexId.has(apexId)) {
      await this.fetchReferences(requestId, apexId);
      if (!this.variableContainerReferenceByApexId.has(apexId)) {
        this.log(
          TRACE_CATEGORY_VARIABLES,
          `resolveApexIdToVariableReference: no reference found for apexId ${apexId} (request ${requestId})`
        );
        return;
      }
    }
    const variableReference = this.variableContainerReferenceByApexId.get(
      apexId
    );
    this.log(
      TRACE_CATEGORY_VARIABLES,
      `resolveApexIdToVariableReference: resolved apexId=${apexId} to variableReference=${variableReference}`
    );
    return variableReference;
  }

  public async fetchReferences(
    requestId: string,
    ...apexIds: number[]
  ): Promise<void> {
    this.log(
      TRACE_CATEGORY_VARIABLES,
      `fetchReferences: fetching references with apexIds=${apexIds} (request ${requestId})`
    );
    const referencesResponse = await new ReferencesCommand(
      this.orgInfo.instanceUrl,
      this.orgInfo.accessToken,
      requestId,
      ...apexIds
    ).execute();
    const referencesResponseObj: DebuggerResponse = JSON.parse(
      referencesResponse
    );
    if (
      referencesResponseObj &&
      referencesResponseObj.referencesResponse &&
      referencesResponseObj.referencesResponse.references &&
      referencesResponseObj.referencesResponse.references.references
    ) {
      this.populateReferences(
        referencesResponseObj.referencesResponse.references.references,
        requestId
      );
    }
  }

  public async fetchReferencesIfNecessary(
    requestId: string,
    apexIds: number[]
  ): Promise<void> {
    const apexIdsToFetch = apexIds.filter(
      apexId => !this.variableContainerReferenceByApexId.has(apexId)
    );
    if (apexIdsToFetch.length === 0) {
      return;
    }
    this.log(
      TRACE_CATEGORY_VARIABLES,
      `fetchReferences: fetching references with apexIds=${apexIdsToFetch} (request ${requestId})`
    );
    await this.fetchReferences(requestId, ...apexIdsToFetch);
  }

  protected printToDebugConsole(
    msg?: string,
    sourceFile?: Source,
    sourceLine?: number
  ): void {
    if (msg && msg.length !== 0) {
      const event: DebugProtocol.OutputEvent = new OutputEvent(
        `${msg}${ApexDebug.LINEBREAK}`,
        'stdout'
      );
      event.body.source = sourceFile;
      event.body.line = sourceLine;
      event.body.column = 0;
      this.sendEvent(event);
    }
  }

  protected warnToDebugConsole(msg?: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(
        new OutputEvent(`${msg}${ApexDebug.LINEBREAK}`, 'console')
      );
    }
  }

  protected errorToDebugConsole(msg?: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(new OutputEvent(`${msg}${ApexDebug.LINEBREAK}`, 'stderr'));
    }
  }

  public log(traceCategory: TraceCategory, message: string) {
    if (
      this.trace &&
      (this.traceAll || this.trace.indexOf(traceCategory) >= 0)
    ) {
      this.printToDebugConsole(`${process.pid}: ${message}`);
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
          this.printToDebugConsole(
            nls.localize('streaming_connected_text', channel)
          );
        })
        .withDisconnectedHandler(() => {
          this.printToDebugConsole(
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
    const type: ApexDebuggerEventType = (ApexDebuggerEventType as any)[
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

    this.printToDebugConsole(
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

      // cleanup everything that's no longer necessary after all request finished
      if (this.requestThreads.size === 0) {
        this.log(
          TRACE_CATEGORY_VARIABLES,
          'handleRequestFinished: clearing variable cache'
        );
        this.stackFrameInfos.reset();
        this.variableHandles.reset();
        this.variableContainerReferenceByApexId.clear();
      }
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
    const reason = message.sobject.BreakpointId ? 'breakpoint' : 'step';
    const threadId = this.getThreadIdFromRequestId(message.sobject.RequestId);

    this.log(
      TRACE_CATEGORY_LAUNCH,
      `handleStopped: got ${reason} event from server for thread ${threadId}`
    );
    if (threadId !== undefined) {
      // cleanup everything that's no longer valid after a stop event
      // but only if only one request is currently debugged (we wan't to preserve the info for a second request)
      if (this.requestThreads.size === 1) {
        this.log(
          TRACE_CATEGORY_VARIABLES,
          'handleStopped: clearing variable cache'
        );
        this.stackFrameInfos.reset();
        this.variableHandles.reset();
        this.variableContainerReferenceByApexId.clear();
      }

      // log to console and notify client
      this.logEvent(message);
      const stoppedEvent: DebugProtocol.StoppedEvent = new StoppedEvent(
        reason,
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
