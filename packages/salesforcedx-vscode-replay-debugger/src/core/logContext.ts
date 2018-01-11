/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { StackFrame } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../adapter/apexReplayDebug';
import { DebugLogState } from '../states';
import { LogContextUtil } from './logContextUtil';

export class LogContext {
  private readonly util = new LogContextUtil();
  private readonly launchArgs: LaunchRequestArguments;
  private readonly logLines: string[] = [];
  private state: DebugLogState;
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

  public updateFrames(): void {
    while (++this.logLinePosition < this.logLines.length) {
      const logLine = this.logLines[this.logLinePosition];
      this.state = this.util.parseLogEvent(logLine);
      if (this.state && this.state.handle(this)) {
        break;
      }
    }
  }
}
