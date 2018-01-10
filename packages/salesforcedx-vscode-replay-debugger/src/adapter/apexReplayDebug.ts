/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import {
  DebugSession,
  OutputEvent,
  Source,
  StoppedEvent,
  Thread,
  ThreadEvent
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { LogContext } from '../core/logContext';
import { nls } from '../messages';

export interface LaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  logFile: string;
  stopOnEntry: boolean | true;
  trace: boolean | true;
}

export class ApexReplayDebug extends DebugSession {
  public static THREAD_ID = 1;
  protected logFile: LogContext;

  constructor() {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerPathFormat('uri');
  }

  public initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    response.body = {
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
    response.success = true;
    this.sendResponse(response);
  }

  public launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments
  ): void {
    if (args.logFile) {
      args.logFile = this.convertDebuggerPathToClient(args.logFile);
    }
    this.logFile = new LogContext(args);
    if (!this.logFile.hasLogLines()) {
      response.success = false;
      response.message = nls.localize('no_log_file_text');
      this.sendResponse(response);
      return;
    }
    if (args.stopOnEntry) {
      this.logFile.updateFrames();
      this.sendEvent(new StoppedEvent('entry', ApexReplayDebug.THREAD_ID));
    } else {
      // Continue until first breakpoint
    }
    this.printToDebugConsole(
      nls.localize('session_started_text', this.logFile.getLogFileName())
    );
    response.success = true;
    this.sendResponse(response);
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
      threads: [
        new Thread(ApexReplayDebug.THREAD_ID, this.logFile.getLogFileName())
      ]
    };
    response.success = true;
    this.sendResponse(response);
  }

  public stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ): void {
    response.body = { stackFrames: this.logFile.getFrames().reverse() };
    response.success = true;
    this.sendResponse(response);
  }

  public continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): void {
    this.sendEvent(new ThreadEvent('exited', ApexReplayDebug.THREAD_ID));
    response.success = true;
    this.sendResponse(response);
  }

  public printToDebugConsole(
    msg?: string,
    sourceFile?: Source,
    sourceLine?: number
  ): void {
    if (msg && msg.length !== 0) {
      const event: DebugProtocol.OutputEvent = new OutputEvent(
        `${msg}${EOL}`,
        'stdout'
      );
      event.body.source = sourceFile;
      event.body.line = sourceLine;
      event.body.column = 0;
      this.sendEvent(event);
    }
  }

  public warnToDebugConsole(msg?: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(new OutputEvent(`${msg}${EOL}`, 'console'));
    }
  }

  public errorToDebugConsole(msg?: string): void {
    if (msg && msg.length !== 0) {
      this.sendEvent(new OutputEvent(`${msg}${EOL}`, 'stderr'));
    }
  }
}

DebugSession.run(ApexReplayDebug);
