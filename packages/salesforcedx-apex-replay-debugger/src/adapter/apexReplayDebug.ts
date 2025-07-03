/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
  Thread
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { EOL } from 'node:os';
import { breakpointUtil } from '../breakpoints';
import { SEND_METRIC_GENERAL_EVENT, SEND_METRIC_ERROR_EVENT, SEND_METRIC_LAUNCH_EVENT } from '../constants';
import { HeapDumpService } from '../core/heapDumpService';
import { LogContext } from '../core/logContext';
import { nls } from '../messages';
import { TraceCategory, Step, LaunchRequestArguments } from './types';
import { ScopeContainer } from './variableContainer';

const TRACE_ALL = 'all';
const TRACE_CATEGORY_PROTOCOL = 'protocol';
const TRACE_CATEGORY_LOGFILE = 'logfile';
const TRACE_CATEGORY_LAUNCH = 'launch';
const TRACE_CATEGORY_BREAKPOINTS = 'breakpoints';

export class ApexReplayDebug extends LoggingDebugSession {
  public static THREAD_ID = 1;
  protected logContext!: LogContext;
  protected heapDumpService!: HeapDumpService;
  protected trace: string[] = [];
  protected traceAll = false;
  private initializedResponse!: DebugProtocol.InitializeResponse;
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
  }

  public async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): Promise<void> {
    let lineBreakpointInfoAvailable = false;
    if (args?.lineBreakpointInfo) {
      lineBreakpointInfoAvailable = true;
      breakpointUtil.createMappingsFromLineBreakpointInfo(args.lineBreakpointInfo);
      delete args.lineBreakpointInfo;
    }
    this.projectPath = args.projectPath;
    response.success = false;
    this.setupLogger(args);
    this.log(TRACE_CATEGORY_LAUNCH, `launchRequest: args=${JSON.stringify(args)}`);
    this.sendEvent(
      new Event(SEND_METRIC_GENERAL_EVENT, {
        subject: `launchRequest: args=${JSON.stringify(args)}`,
        type: 'launchApexReplayDebugger'
      })
    );

    this.logContext = await LogContext.create(args, this);
    this.heapDumpService = new HeapDumpService(this.logContext);

    if (!this.logContext.hasLogLines()) {
      response.message = nls.localize('no_log_file_text');
      this.sendEvent(
        new Event(SEND_METRIC_ERROR_EVENT, {
          subject: 'No log lines found',
          callstack: new Error().stack,
          message: response.message
        })
      );
    } else if (!this.logContext.meetsLogLevelRequirements()) {
      response.message = nls.localize('incorrect_log_levels_text');
      this.sendEvent(
        new Event(SEND_METRIC_ERROR_EVENT, {
          subject: 'Incorrect log levels',
          callstack: new Error().stack,
          message: response.message
        })
      );
    } else if (!lineBreakpointInfoAvailable) {
      response.message = nls.localize('session_language_server_error_text');
      this.sendEvent(
        new Event(SEND_METRIC_ERROR_EVENT, {
          subject: 'No line breakpoint info available',
          callstack: new Error().stack,
          message: response.message
        })
      );
    } else {
      this.printToDebugConsole(nls.localize('session_started_text', this.logContext.getLogFileName()));
      if (
        this.projectPath &&
        this.logContext.scanLogForHeapDumpLines() &&
        !(await this.logContext.fetchOverlayResultsForApexHeapDumps(this.projectPath))
      ) {
        response.message = nls.localize('heap_dump_error_wrap_up_text');
        this.errorToDebugConsole(nls.localize('heap_dump_error_wrap_up_text'));
        this.sendEvent(
          new Event(SEND_METRIC_ERROR_EVENT, {
            subject: 'Fetching heap dumps failed',
            callstack: new Error().stack,
            message: response.message
          })
        );
      }
      response.success = true;
    }
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
    this.sendEvent(
      new Event(SEND_METRIC_LAUNCH_EVENT, {
        logSize: this.logContext.getLogSize(),
        error: {
          subject: response.message
        }
      })
    );
  }

  public setupLogger(args: LaunchRequestArguments): void {
    if (typeof args.trace === 'boolean') {
      this.trace = args.trace ? [TRACE_ALL] : [];
      this.traceAll = args.trace;
    } else if (typeof args.trace === 'string') {
      this.trace = args.trace.split(',').map(category => category.trim());
      this.traceAll = this.trace.includes(TRACE_ALL);
    }
    if (this.trace?.indexOf(TRACE_CATEGORY_PROTOCOL) >= 0) {
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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.continueRequest({} as DebugProtocol.ContinueResponse, {
        threadId: ApexReplayDebug.THREAD_ID
      });
    }
    this.sendEvent(
      new Event(SEND_METRIC_GENERAL_EVENT, {
        subject: 'configurationDoneRequest',
        type: 'apexReplayDebuggerConfigurationDone'
      })
    );
  }

  public disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
    this.printToDebugConsole(nls.localize('session_terminated_text'));
    response.success = true;
    this.sendResponse(response);
    this.sendEvent(
      new Event(SEND_METRIC_GENERAL_EVENT, {
        subject: 'disconnectRequest',
        type: 'apexReplayDebuggerDisconnect'
      })
    );
  }

  public threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(ApexReplayDebug.THREAD_ID, '')]
    };
    response.success = true;
    this.sendResponse(response);
  }

  public stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
    response.body = {
      stackFrames: this.logContext.getFrames().slice().reverse()
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
        this.sendEvent(
          new Event(SEND_METRIC_ERROR_EVENT, {
            subject: 'Heap dump processing error',
            callstack: error.stack,
            message: error.message
          })
        );
        this.logContext.revertStateAfterHeapDump();
        this.warnToDebugConsole(nls.localize('reconcile_heapdump_error', error, heapDumpId, heapDumpId));
      } finally {
        this.logContext.resetLastSeenHeapDumpLogLine();
      }
    }

    response.success = true;
    const frameInfo = this.logContext.getFrameHandler().get(args.frameId);
    if (!frameInfo) {
      response.body = { scopes: [] };
      this.sendResponse(response);
      return;
    }
    const scopes = [
      new Scope(
        'Local',
        this.logContext.getVariableHandler().create(new ScopeContainer('local', frameInfo.locals)),
        false
      ),
      new Scope(
        'Static',
        this.logContext.getVariableHandler().create(new ScopeContainer('static', frameInfo.statics)),
        false
      ),
      new Scope(
        'Global',
        this.logContext.getVariableHandler().create(new ScopeContainer('global', frameInfo.globals)),
        false
      )
    ];
    response.body = { scopes };
    this.sendResponse(response);
    this.sendEvent(
      new Event(SEND_METRIC_GENERAL_EVENT, {
        subject: 'scopesRequest',
        type: 'apexReplayDebuggerScopesRequest',
        numberOfScopes: scopes.length
      })
    );
  }

  public async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ): Promise<void> {
    response.success = true;
    try {
      const scopesContainer = this.logContext.getVariableHandler().get(args.variablesReference);
      response.body = {
        variables: scopesContainer ? scopesContainer.getAllVariables() : []
      };
      this.sendResponse(response);
    } catch (error) {
      this.sendEvent(
        new Event(SEND_METRIC_ERROR_EVENT, {
          subject: 'Error in variablesRequest',
          callstack: error.stack,
          message: error.message
        })
      );
      response.success = false;
      this.sendResponse(response);
    }
  }

  protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
    response.body = {
      result: args.expression,
      variablesReference: 0
    };
    response.success = true;
    this.sendResponse(response);
  }

  public continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
    this.executeStep(response, 'Run');
  }

  public nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
    this.executeStep(response, 'Over');
  }

  public stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
    this.executeStep(response, 'In');
  }

  public stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
    this.executeStep(response, 'Out');
  }

  protected executeStep(response: DebugProtocol.Response, stepType: Step): void {
    response.success = true;
    this.sendResponse(response);
    try {
      const prevNumOfFrames = this.logContext.getNumOfFrames();
      while (this.logContext.hasLogLines()) {
        this.logContext.updateFrames();
        const curNumOfFrames = this.logContext.getNumOfFrames();
        if (
          (stepType === 'Over' && curNumOfFrames !== 0 && curNumOfFrames <= prevNumOfFrames) ||
          (stepType === 'In' && curNumOfFrames >= prevNumOfFrames) ||
          (stepType === 'Out' && curNumOfFrames !== 0 && curNumOfFrames < prevNumOfFrames)
        ) {
          return this.sendEvent(new StoppedEvent('step', ApexReplayDebug.THREAD_ID));
        }
        if (this.shouldStopForBreakpoint()) {
          return;
        }
      }
      this.sendEvent(new TerminatedEvent());
    } catch (error) {
      this.sendEvent(
        new Event(SEND_METRIC_ERROR_EVENT, {
          subject: 'Error during step execution',
          callstack: error.stack,
          message: error.message
        })
      );
      throw error;
    }
  }

  protected shouldStopForBreakpoint(): boolean {
    const topFrame = this.logContext.getTopFrame();
    const sourcePath = topFrame?.source?.path ?? null;
    const topFrameLine = topFrame?.line ?? null;
    if (sourcePath && topFrameLine) {
      const topFrameUri = this.convertClientPathToDebugger(sourcePath);
      const topFrameLineDebugger = this.convertClientLineToDebugger(topFrameLine);

      const breakpointsForUri = this.breakpoints.get(topFrameUri) ?? []; // Use empty array if breakpoints for the URI are undefined
      if (breakpointsForUri.includes(topFrameLineDebugger)) {
        this.sendEvent(new StoppedEvent('breakpoint', ApexReplayDebug.THREAD_ID));
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
        `setBreakPointsRequest: path=${
          args.source.path
        } uri=${uri} lines=${breakpointUtil.returnLinesForLoggingFromBreakpointArgs(args.breakpoints)}`
      );
      this.breakpoints.set(uri, []);
      for (const bp of args.breakpoints) {
        const isVerified = breakpointUtil.canSetLineBreakpoint(uri, this.convertClientLineToDebugger(bp.line));
        response.body.breakpoints.push({
          verified: isVerified,
          source: args.source,
          line: bp.line
        });
        if (isVerified) {
          this.breakpoints.get(uri)!.push(this.convertClientLineToDebugger(bp.line));
        } else {
          // Report an error metric when a breakpoint fails to verify
          this.sendEvent(
            new Event(SEND_METRIC_ERROR_EVENT, {
              subject: 'Failed to set breakpoint',
              callstack: new Error().stack,
              message: `Failed to set breakpoint at line ${bp.line} in ${args.source.path}`
            })
          );
        }
      }
      this.log(
        TRACE_CATEGORY_BREAKPOINTS,
        `setBreakPointsRequest: path=${args.source.path} verified lines=${this.breakpoints.get(uri)!.join(',')}`
      );
      this.sendEvent(
        new Event(SEND_METRIC_GENERAL_EVENT, {
          subject: 'setBreakPointsRequest',
          type: 'apexReplayDebuggerSetBreakpoints',
          numberOfVerifiedBreakpoints: response.body.breakpoints.filter(bp => bp.verified).length
        })
      );
    } else {
      this.sendEvent(
        new Event(SEND_METRIC_ERROR_EVENT, {
          subject: 'setBreakPointsRequest - path or breakpoints invalid',
          type: 'apexReplayDebuggerSetBreakpoints'
        })
      );
    }
    response.success = true;
    this.sendResponse(response);
  }

  public log(traceCategory: TraceCategory, message: string) {
    if (this.trace && (this.traceAll || this.trace.includes(traceCategory))) {
      this.printToDebugConsole(`${process.pid}: ${message}`);
    }
  }

  public shouldTraceLogFile(): boolean {
    return this.traceAll || this.trace.includes(TRACE_CATEGORY_LOGFILE);
  }

  public printToDebugConsole(msg: string, sourceFile?: Source, sourceLine?: number, category = 'stdout'): void {
    if (msg?.length !== 0) {
      const event: DebugProtocol.OutputEvent = new OutputEvent(`${msg}${EOL}`, category);
      event.body.source = sourceFile;
      event.body.line = sourceLine;
      event.body.column = 0;
      this.sendEvent(event);
    }
  }

  public warnToDebugConsole(msg: string, sourceFile?: Source, sourceLine?: number): void {
    this.printToDebugConsole(msg, sourceFile, sourceLine, 'console');
  }

  public errorToDebugConsole(msg: string, sourceFile?: Source, sourceLine?: number): void {
    this.printToDebugConsole(msg, sourceFile, sourceLine, 'stderr');
  }
}

DebugSession.run(ApexReplayDebug);
