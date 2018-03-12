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
  Source,
  StoppedEvent,
  TerminatedEvent,
  Thread
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { BreakpointUtil, LineBreakpointInfo } from '../breakpoints';
import {
  CheckpointMessage,
  checkpointService
} from '../breakpoints/checkpointService';
import {
  CHECKPOINT,
  CHECKPOINT_INFO_EVENT,
  DEFAULT_INITIALIZE_TIMEOUT_MS,
  GET_LINE_BREAKPOINT_INFO_EVENT,
  LINE_BREAKPOINT_INFO_REQUEST
} from '../constants';
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

export class ApexReplayDebug extends LoggingDebugSession {
  public static THREAD_ID = 1;
  protected logContext: LogContext;
  protected trace: string[] = [];
  protected traceAll = false;
  private breakpointUtil: BreakpointUtil;
  private initializedResponse: DebugProtocol.InitializeResponse;
  protected breakpoints: Map<string, number[]> = new Map();

  constructor() {
    super('apex-replay-debug-adapter.log');
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerPathFormat('uri');
    this.breakpointUtil = new BreakpointUtil();
  }

  public initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    this.initializedResponse = response;
    this.sendEvent(new Event(GET_LINE_BREAKPOINT_INFO_EVENT));
    setTimeout(() => {
      if (!this.breakpointUtil.hasLineNumberMapping()) {
        this.initializedResponse.success = false;
        this.initializedResponse.message = nls.localize(
          'session_language_server_error_text'
        );
        this.sendResponse(this.initializedResponse);
      }
    }, DEFAULT_INITIALIZE_TIMEOUT_MS);
  }

  public launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): void {
    this.setupLogger(args);

    this.log(
      TRACE_CATEGORY_LAUNCH,
      `launchRequest: args=${JSON.stringify(args)}`
    );
    this.logContext = new LogContext(args, this);
    if (!this.logContext.hasLogLines()) {
      response.success = false;
      response.message = nls.localize('no_log_file_text');
      this.sendResponse(response);
      return;
    }
    this.printToDebugConsole(
      nls.localize('session_started_text', this.logContext.getLogFileName())
    );
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
    if (args.source.path && args.lines && args.breakpoints) {
      this.log(
        TRACE_CATEGORY_BREAKPOINTS,
        `setBreakPointsRequest: path=${args.source
          .path} lines=${args.lines.join(',')}`
      );
      const uri = this.convertClientPathToDebugger(args.source.path);
      this.breakpoints.set(uri, []);
      // While processing the breakpoints, if there's a conditional breakpoint
      // then create a checkpoint. This requires checking the breakpoint condition
      // for the appropriate args.lines item being processed.
      let i: number;
      for (i = 0; i < args.lines.length; i++) {
        const lineArg = args.lines[i];
        const isVerified = this.breakpointUtil.canSetLineBreakpoint(
          uri,
          this.convertClientLineToDebugger(lineArg)
        );
        response.body.breakpoints.push({
          verified: isVerified,
          source: args.source,
          line: lineArg
        });
        if (isVerified) {
          this.breakpoints.get(uri)!.push(
            this.convertClientLineToDebugger(lineArg)
          );
        }
        // If there is a condition and that condition is a checkpoint then
        // sent CHECKPOINT_INFO_EVENT with the args.source, line and uri
        if (args.breakpoints[i].condition) {
          if (
            args.breakpoints[i].condition!.toLowerCase().indexOf(CHECKPOINT) >=
            0
          ) {
            // JRS
            this.sendEvent(
              new Event(CHECKPOINT_INFO_EVENT, {
                source: args.source,
                line: lineArg,
                uri: uri
              } as CheckpointMessage)
            );
          }
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
        const lineBpInfo: LineBreakpointInfo[] = args;
        if (lineBpInfo && lineBpInfo.length > 0) {
          const lineNumberMapping: Map<string, number[]> = new Map();
          const typerefMapping: Map<string, string> = new Map();
          for (const info of lineBpInfo) {
            if (!lineNumberMapping.has(info.uri)) {
              lineNumberMapping.set(info.uri, []);
            }
            lineNumberMapping.set(
              info.uri,
              lineNumberMapping.get(info.uri)!.concat(info.lines)
            );
            typerefMapping.set(info.typeref, info.uri);
          }
          this.breakpointUtil.setValidLines(lineNumberMapping, typerefMapping);
        }
        if (this.initializedResponse) {
          this.initializedResponse.body = {
            supportsConfigurationDoneRequest: true,
            supportsCompletionsRequest: false,
            supportsConditionalBreakpoints: false,
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
          this.sendEvent(new InitializedEvent());
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

  public getBreakpointUtil(): BreakpointUtil {
    return this.breakpointUtil;
  }
}

DebugSession.run(ApexReplayDebug);
