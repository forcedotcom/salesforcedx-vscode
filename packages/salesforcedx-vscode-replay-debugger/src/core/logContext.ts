/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { StackFrame } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../adapter/apexReplayDebug';
import { BreakpointUtil } from '../breakpoints';
import {
  EVENT_CODE_UNIT_FINISHED,
  EVENT_CODE_UNIT_STARTED,
  EVENT_CONSTRUCTOR_ENTRY,
  EVENT_CONSTRUCTOR_EXIT,
  EVENT_EXECUTE_ANONYMOUS,
  EVENT_METHOD_ENTRY,
  EVENT_METHOD_EXIT,
  EVENT_STATEMENT_EXECUTE,
  EXEC_ANON_SIGNATURE
} from '../constants';
import {
  DebugLogState,
  FrameEntryState,
  FrameExitState,
  LogEntryState,
  NoOpState,
  StatementExecuteState
} from '../states';
import { LogContextUtil } from './logContextUtil';

export class LogContext {
  private readonly util = new LogContextUtil();
  private readonly breakpointUtil: BreakpointUtil;
  private readonly launchArgs: LaunchRequestArguments;
  private readonly logLines: string[] = [];
  private state: DebugLogState | undefined;
  private stackFrameInfos: StackFrame[] = [];
  private logLinePosition = -1;
  private execAnonMapping: Map<number, number> = new Map();

  constructor(
    launchArgs: LaunchRequestArguments,
    breakpointUtil: BreakpointUtil
  ) {
    this.launchArgs = launchArgs;
    this.breakpointUtil = breakpointUtil;
    this.logLines = this.util.readLogFile(launchArgs.logFile);
  }

  public getLaunchArgs(): LaunchRequestArguments {
    return this.launchArgs;
  }

  public getLogLines(): string[] {
    return this.logLines;
  }

  public hasLogLines(): boolean {
    return (
      this.logLines &&
      this.logLines.length > 0 &&
      this.logLinePosition < this.logLines.length
    );
  }

  public getLogFileName(): string {
    return path.basename(this.launchArgs.logFile);
  }

  public getLogFilePath(): string {
    return this.launchArgs.logFile;
  }

  public getLogLinePosition(): number {
    return this.logLinePosition;
  }

  public getFrames(): StackFrame[] {
    return this.stackFrameInfos;
  }

  public getTopFrame(): StackFrame | undefined {
    if (this.stackFrameInfos.length > 0) {
      return this.stackFrameInfos[this.stackFrameInfos.length - 1];
    }
  }

  public setState(state: DebugLogState | undefined): void {
    this.state = state;
  }

  public hasState(): boolean {
    return this.state !== undefined;
  }

  public getExecAnonScriptLocationInDebugLog(scriptLine: number): number {
    return this.execAnonMapping.get(scriptLine) || 0;
  }

  public getExecAnonScriptMapping(): Map<number, number> {
    return this.execAnonMapping;
  }

  public getUriFromSignature(signature: string): string {
    if (signature === EXEC_ANON_SIGNATURE) {
      return encodeURI('file://' + this.getLogFilePath());
    }
    const processedSignature = signature.endsWith(')')
      ? signature.substring(0, signature.lastIndexOf('.'))
      : signature;
    const typerefMapping = this.breakpointUtil.getTyperefMapping();
    let uri = '';
    typerefMapping.forEach((value, key) => {
      const processedKey = key.replace('/', '.').replace('$', '.');
      if (processedKey === processedSignature) {
        uri = value;
        return;
      }
    });
    return uri;
  }

  public updateFrames(printLine: (message: string) => void): void {
    if (this.state instanceof LogEntryState) {
      this.stackFrameInfos.pop();
    }
    while (++this.logLinePosition < this.logLines.length) {
      const logLine = this.logLines[this.logLinePosition];
      if (logLine) {
        printLine(logLine);
        this.setState(this.parseLogEvent(logLine));
        if (this.state && this.state.handle(this)) {
          break;
        }
      }
    }
  }

  public parseLogEvent(logLine: string): DebugLogState {
    if (this.state === undefined) {
      return new LogEntryState();
    }
    if (logLine.startsWith(EVENT_EXECUTE_ANONYMOUS)) {
      this.execAnonMapping.set(
        this.execAnonMapping.size + 1,
        this.logLinePosition + 1
      );
    }
    const fields = logLine.split('|');
    if (fields.length >= 3) {
      switch (fields[1]) {
        case EVENT_CODE_UNIT_STARTED:
        case EVENT_CONSTRUCTOR_ENTRY:
        case EVENT_METHOD_ENTRY:
          return new FrameEntryState(fields);
        case EVENT_CODE_UNIT_FINISHED:
        case EVENT_CONSTRUCTOR_EXIT:
        case EVENT_METHOD_EXIT:
          return new FrameExitState(fields);
        case EVENT_STATEMENT_EXECUTE:
          if (logLine.match(/.*\|.*\|\[\d{1,}\]/)) {
            fields[2] = this.util.stripBrackets(fields[2]);
            return new StatementExecuteState(fields);
          }
          break;
        default:
          return new NoOpState();
      }
    }

    return new NoOpState();
  }
}
