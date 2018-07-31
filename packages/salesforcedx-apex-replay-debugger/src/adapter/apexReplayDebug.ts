/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import {
  DebugSession,
  Event,
  InitializedEvent,
  logger,
  Logger,
  LoggingDebugSession,
  OutputEvent,
  Scope,
  Source,
  StoppedEvent,
  TerminatedEvent,
  Thread,
  Variable
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { breakpointUtil, LineBreakpointEventArgs } from '../breakpoints';
import {
  GET_LINE_BREAKPOINT_INFO_EVENT,
  LINE_BREAKPOINT_INFO_REQUEST
} from '../constants';
import { HeapDumpService } from '../core/heapDumpService';
import { LogContext } from '../core/logContext';
import { nls } from '../messages';

const TRACE_ALL = 'all';
const TRACE_CATEGORY_PROTOCOL = 'protocol';
const TRACE_CATEGORY_LOGFILE = 'logfile';
const TRACE_CATEGORY_LAUNCH = 'launch';
const TRACE_CATEGORY_BREAKPOINTS = 'breakpoints';

export type TraceCategory =
  | 'all'
  | 'protocol'
  | 'logfile'
  | 'launch'
  | 'breakpoints';

export enum Step {
  Over,
  In,
  Out,
  Run
}

export interface LaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  logFile: string;
  stopOnEntry?: boolean | true;
  trace?: boolean | string;
}

export class ApexVariable extends Variable {
  public readonly type: string;
  public readonly apexRef: string | undefined;
  public readonly evaluateName: string;

  public constructor(
    name: string,
    value: string,
    type: string,
    ref = 0,
    apexRef?: string
  ) {
    super(name, value, ref);
    this.type = type;
    this.apexRef = apexRef;
    this.evaluateName = value;
  }
}

export class ApexDebugStackFrameInfo {
  public readonly frameNumber: number;
  public readonly signature: string;
  public statics: Map<string, VariableContainer>;
  public locals: Map<string, VariableContainer>;
  public globals: Map<string, VariableContainer>;

  public constructor(frameNumber: number, signature: string) {
    this.frameNumber = frameNumber;
    this.signature = signature;
    this.statics = new Map<string, VariableContainer>();
    this.locals = new Map<string, VariableContainer>();
    this.globals = new Map<string, VariableContainer>();
  }

  public copy(): ApexDebugStackFrameInfo {
    const me = new ApexDebugStackFrameInfo(this.frameNumber, this.signature);
    this.statics.forEach((value, key) => {
      me.statics.set(key, value.copy());
    });
    this.locals.forEach((value, key) => {
      me.locals.set(key, value.copy());
    });
    return me;
  }
}

export enum SCOPE_TYPES {
  LOCAL = 'local',
  STATIC = 'static',
  GLOBAL = 'global'
}

export abstract class VariableContainer {
  public variables: Map<string, VariableContainer>;

  public constructor(
    variables: Map<string, VariableContainer> = new Map<
      string,
      VariableContainer
    >()
  ) {
    this.variables = variables;
  }

  public getAllVariables(): ApexVariable[] {
    const result: ApexVariable[] = [];
    this.variables.forEach(container => {
      const avc = container as ApexVariableContainer;
      result.push(
        new ApexVariable(avc.name, avc.value, avc.type, avc.variablesRef)
      );
    });
    return result;
  }

  public copy(): VariableContainer {
    const me = Object.assign(Object.create(Object.getPrototypeOf(this)));
    me.variables = new Map<string, VariableContainer>();
    this.variables.forEach((value, key) => {
      me.variables.set(key, value.copy());
    });
    return me;
  }
}

export class ApexVariableContainer extends VariableContainer {
  public name: string;
  public value: string;
  public type: string;
  public ref: string | undefined;
  public variablesRef: number;
  public constructor(
    name: string,
    value: string,
    type: string,
    ref?: string,
    variablesRef: number = 0
  ) {
    super();
    this.name = name;
    this.value = value;
    this.type = type;
    this.ref = ref;
    this.variablesRef = variablesRef;
  }

  public copy(): ApexVariableContainer {
    const me = super.copy() as ApexVariableContainer;
    me.name = this.name;
    me.value = this.value;
    me.type = this.type;
    me.ref = this.ref;
    me.variablesRef = this.variablesRef;
    return me;
  }
}

export class ScopeContainer extends VariableContainer {
  public readonly type: SCOPE_TYPES;

  public constructor(
    type: SCOPE_TYPES,
    variables: Map<string, VariableContainer>
  ) {
    super(variables);
    this.type = type;
  }

  public getAllVariables(): ApexVariable[] {
    const apexVariables: ApexVariable[] = [];
    this.variables.forEach(entry => {
      const avc = entry as ApexVariableContainer;
      apexVariables.push(
        new ApexVariable(avc.name, avc.value, avc.type, avc.variablesRef)
      );
    });
    return apexVariables;
  }
}

export class ApexReplayDebug extends LoggingDebugSession {
  public static THREAD_ID = 1;
  protected logContext: LogContext;
  protected heapDumpService: HeapDumpService;
  protected trace: string[] = [];
  protected traceAll = false;
  private initializedResponse: DebugProtocol.InitializeResponse;
  protected breakpoints: Map<string, number[]> = new Map();
  protected projectPath: string | undefined;

  constructor() {
    super('apex-replay-debug-adapter.log');
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerPathFormat('uri');
  }

  public initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    this.initializedResponse = response;
    this.sendEvent(new Event(GET_LINE_BREAKPOINT_INFO_EVENT));
  }

  public async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): Promise<void> {
    response.success = false;
    this.setupLogger(args);
    this.log(
      TRACE_CATEGORY_LAUNCH,
      `launchRequest: args=${JSON.stringify(args)}`
    );

    this.logContext = new LogContext(args, this);
    this.heapDumpService = new HeapDumpService(this.logContext);
    this.sendEvent(new InitializedEvent());

    if (!this.logContext.hasLogLines()) {
      response.message = nls.localize('no_log_file_text');
      this.sendResponse(response);
      return;
    } else if (!this.logContext.meetsLogLevelRequirements()) {
      response.message = nls.localize('incorrect_log_levels_text');
      this.sendResponse(response);
      return;
    }
    this.printToDebugConsole(
      nls.localize('session_started_text', this.logContext.getLogFileName())
    );
    // If the projectPath isn't set then don't bother with heap dump processing
    if (this.projectPath && this.logContext.scanLogForHeapDumpLines()) {
      if (
        !await this.logContext.fetchOverlayResultsForApexHeapDumps(
          this.projectPath
        )
      ) {
        this.errorToDebugConsole(nls.localize('heap_dump_error_wrap_up_text'));
      }
    }
    response.success = true;
    this.sendResponse(response);
  }

  public setupLogger(args: LaunchRequestArguments): void {
    if (typeof args.trace === 'boolean') {
      this.trace = args.trace ? [TRACE_ALL] : [];
      this.traceAll = args.trace;
    } else if (typeof args.trace === 'string') {
      this.trace = args.trace.split(',').map(category => category.trim());
      this.traceAll = this.trace.indexOf(TRACE_ALL) >= 0;
    }
    if (this.trace && this.trace.indexOf(TRACE_CATEGORY_PROTOCOL) >= 0) {
      logger.setup(Logger.LogLevel.Verbose, false);
    } else {
      logger.setup(Logger.LogLevel.Stop, false);
    }
  }

  public configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments
  ): void {
    if (this.logContext.getLaunchArgs().stopOnEntry) {
      // Stop in the debug log
      this.logContext.updateFrames();
      this.sendEvent(new StoppedEvent('entry', ApexReplayDebug.THREAD_ID));
    } else {
      // Set breakpoints first, then try to continue to the next breakpoint
      this.continueRequest({} as DebugProtocol.ContinueResponse, {
        threadId: ApexReplayDebug.THREAD_ID
      });
    }
  }

  public disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): void {
    this.printToDebugConsole(nls.localize('session_terminated_text'));
    response.success = true;
    this.sendResponse(response);
  }

  public threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(ApexReplayDebug.THREAD_ID, '')]
    };
    response.success = true;
    this.sendResponse(response);
  }

  public stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ): void {
    response.body = {
      stackFrames: this.logContext
        .getFrames()
        .slice()
        .reverse()
    };
    response.success = true;
    this.sendResponse(response);
  }

  public async scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments
  ): Promise<void> {
    const heapDumpId = this.logContext.hasHeapDumpForTopFrame();
    if (heapDumpId) {
      try {
        this.logContext.copyStateForHeapDump();
        this.heapDumpService.replaceVariablesWithHeapDump();
      } catch (error) {
        this.logContext.revertStateAfterHeapDump();
        this.warnToDebugConsole(
          nls.localize(
            'reconcile_heapdump_error',
            error,
            heapDumpId,
            heapDumpId
          )
        );
      }
    }

    response.success = true;
    const frameInfo = this.logContext.getFrameHandler().get(args.frameId);
    if (!frameInfo) {
      response.body = { scopes: [] };
      this.sendResponse(response);
      return;
    }
    const scopes = new Array<Scope>();
    scopes.push(
      new Scope(
        'Local',
        this.logContext
          .getVariableHandler()
          .create(new ScopeContainer(SCOPE_TYPES.LOCAL, frameInfo.locals)),
        false
      )
    );
    scopes.push(
      new Scope(
        'Static',
        this.logContext
          .getVariableHandler()
          .create(new ScopeContainer(SCOPE_TYPES.STATIC, frameInfo.statics)),
        false
      )
    );
    // Right now, globals are only going to exist if there's a heapdump and the frame
    // source is a trigger.
    if (heapDumpId && this.logContext.isRunningApexTrigger()) {
      scopes.push(
        new Scope(
          'Global',
          this.logContext
            .getVariableHandler()
            .create(new ScopeContainer(SCOPE_TYPES.GLOBAL, frameInfo.globals)),
          false
        )
      );
    }
    response.body = { scopes };
    this.sendResponse(response);
  }

  public async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ): Promise<void> {
    response.success = true;
    const scopesContainer = this.logContext
      .getVariableHandler()
      .get(args.variablesReference);
    response.body = {
      variables: scopesContainer ? scopesContainer.getAllVariables() : []
    };
    this.sendResponse(response);
  }

  protected evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments
  ): void {
    response.body = {
      result: args.expression,
      variablesReference: 0
    };
    response.success = true;
    this.sendResponse(response);
  }

  public continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): void {
    this.executeStep(response, Step.Run);
  }

  public nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments
  ): void {
    this.executeStep(response, Step.Over);
  }

  public stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments
  ): void {
    this.executeStep(response, Step.In);
  }

  public stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments
  ): void {
    this.executeStep(response, Step.Out);
  }

  protected executeStep(
    response: DebugProtocol.Response,
    stepType: Step
  ): void {
    response.success = true;
    this.sendResponse(response);
    const prevNumOfFrames = this.logContext.getNumOfFrames();
    while (this.logContext.hasLogLines()) {
      this.logContext.updateFrames();
      const curNumOfFrames = this.logContext.getNumOfFrames();
      if (
        (stepType === Step.Over &&
          curNumOfFrames !== 0 &&
          curNumOfFrames <= prevNumOfFrames) ||
        (stepType === Step.In && curNumOfFrames >= prevNumOfFrames) ||
        (stepType === Step.Out &&
          curNumOfFrames !== 0 &&
          curNumOfFrames < prevNumOfFrames)
      ) {
        return this.sendEvent(
          new StoppedEvent('step', ApexReplayDebug.THREAD_ID)
        );
      }
      if (this.shouldStopForBreakpoint()) {
        return;
      }
    }
    this.sendEvent(new TerminatedEvent());
  }

  protected shouldStopForBreakpoint(): boolean {
    const topFrame = this.logContext.getTopFrame();
    if (topFrame && topFrame.source) {
      const topFrameUri = this.convertClientPathToDebugger(
        topFrame.source.path
      );
      const topFrameLine = this.convertClientLineToDebugger(topFrame.line);
      if (
        this.breakpoints.has(topFrameUri) &&
        this.breakpoints.get(topFrameUri)!.indexOf(topFrameLine) !== -1
      ) {
        this.sendEvent(
          new StoppedEvent('breakpoint', ApexReplayDebug.THREAD_ID)
        );
        return true;
      }
    }
    return false;
  }

  public setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): void {
    response.body = { breakpoints: [] };
    if (args.source.path && args.breakpoints) {
      const uri = this.convertClientPathToDebugger(args.source.path);
      this.log(
        TRACE_CATEGORY_BREAKPOINTS,
        `setBreakPointsRequest: path=${args.source
          .path} uri=${uri} lines=${breakpointUtil.returnLinesForLoggingFromBreakpointArgs(
          args.breakpoints
        )}`
      );
      this.breakpoints.set(uri, []);
      for (const bp of args.breakpoints) {
        const isVerified = breakpointUtil.canSetLineBreakpoint(
          uri,
          this.convertClientLineToDebugger(bp.line)
        );
        response.body.breakpoints.push({
          verified: isVerified,
          source: args.source,
          line: bp.line
        });
        if (isVerified) {
          this.breakpoints.get(uri)!.push(
            this.convertClientLineToDebugger(bp.line)
          );
        }
      }
      this.log(
        TRACE_CATEGORY_BREAKPOINTS,
        `setBreakPointsRequest: path=${args.source
          .path} verified lines=${this.breakpoints.get(uri)!.join(',')}`
      );
    }
    response.success = true;
    this.sendResponse(response);
  }

  public customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any
  ): void {
    response.success = true;
    switch (command) {
      case LINE_BREAKPOINT_INFO_REQUEST:
        if (args) {
          const lineBreakpointEventArgs = args as LineBreakpointEventArgs;
          breakpointUtil.createMappingsFromLineBreakpointInfo(
            lineBreakpointEventArgs.lineBreakpointInfo
          );
          this.projectPath = lineBreakpointEventArgs.projectPath;
        } else {
          this.initializedResponse.success = false;
          this.initializedResponse.message = nls.localize(
            'session_language_server_error_text'
          );
          this.sendResponse(this.initializedResponse);
        }
        if (this.initializedResponse) {
          this.initializedResponse.body = {
            supportsConfigurationDoneRequest: true,
            supportsCompletionsRequest: false,
            supportsConditionalBreakpoints: true,
            supportsDelayedStackTraceLoading: false,
            supportsEvaluateForHovers: false,
            supportsExceptionInfoRequest: false,
            supportsExceptionOptions: false,
            supportsFunctionBreakpoints: false,
            supportsHitConditionalBreakpoints: false,
            supportsLoadedSourcesRequest: false,
            supportsRestartFrame: false,
            supportsSetVariable: false,
            supportsStepBack: false,
            supportsStepInTargetsRequest: false
          };
          this.initializedResponse.success = true;
          this.sendResponse(this.initializedResponse);
          break;
        }
    }
    this.sendResponse(response);
  }

  public log(traceCategory: TraceCategory, message: string) {
    if (
      this.trace &&
      (this.traceAll || this.trace.indexOf(traceCategory) >= 0)
    ) {
      this.printToDebugConsole(`${process.pid}: ${message}`);
    }
  }

  public shouldTraceLogFile(): boolean {
    return this.traceAll || this.trace.indexOf(TRACE_CATEGORY_LOGFILE) !== -1;
  }

  public printToDebugConsole(
    msg: string,
    sourceFile?: Source,
    sourceLine?: number,
    category = 'stdout'
  ): void {
    if (msg && msg.length !== 0) {
      const event: DebugProtocol.OutputEvent = new OutputEvent(
        `${msg}${EOL}`,
        category
      );
      event.body.source = sourceFile;
      event.body.line = sourceLine;
      event.body.column = 0;
      this.sendEvent(event);
    }
  }

  public warnToDebugConsole(
    msg: string,
    sourceFile?: Source,
    sourceLine?: number
  ): void {
    this.printToDebugConsole(msg, sourceFile, sourceLine, 'console');
  }

  public errorToDebugConsole(
    msg: string,
    sourceFile?: Source,
    sourceLine?: number
  ): void {
    this.printToDebugConsole(msg, sourceFile, sourceLine, 'stderr');
  }
}

DebugSession.run(ApexReplayDebug);
