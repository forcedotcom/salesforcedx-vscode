/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { StackFrame } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../adapter/apexReplayDebug';
import { DebugLogState, LogEntryState, NoOpState } from '../states';
import { LogContextUtil } from './logContextUtil';

export class LogContext {
  private readonly util = new LogContextUtil();
  private readonly launchArgs: LaunchRequestArguments;
  private readonly logLines: string[] = [];
  private state: DebugLogState | undefined;
  private stackFrameInfos: StackFrame[] = [];
  private logLinePosition = -1;

  constructor(launchArgs: LaunchRequestArguments) {
    this.launchArgs = launchArgs;
    this.logLines = this.util.readLogFile(launchArgs.logFile);
  }

  public getLogLines(): string[] {
    return this.logLines;
  }

  public hasLogLines(): boolean {
    return this.logLines && this.logLines.length > 0;
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

  public setState(state: DebugLogState | undefined): void {
    this.state = state;
  }

  public updateFrames(): void {
    while (++this.logLinePosition < this.logLines.length) {
      const logLine = this.logLines[this.logLinePosition];
      if (logLine.length) {
        this.state = this.parseLogEvent(logLine);
        if (this.state && this.state.handle(this)) {
          break;
        }
      }
    }
  }

  public parseLogEvent(logLine: string): DebugLogState {
    if (!this.state) {
      return new LogEntryState();
    }
    const fields = logLine.split('|');
    if (fields.length >= 3) {
      switch (fields[1]) {
        default:
          return new NoOpState();
      }
    }

    return new NoOpState();
  }
}
