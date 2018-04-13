/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { Handles, StackFrame, Variable } from 'vscode-debugadapter';
import {
  ApexDebugStackFrameInfo,
  ApexReplayDebug,
  ApexVariable,
  LaunchRequestArguments,
  ScopeContainer
} from '../adapter/apexReplayDebug';
import {
  EVENT_CODE_UNIT_FINISHED,
  EVENT_CODE_UNIT_STARTED,
  EVENT_CONSTRUCTOR_ENTRY,
  EVENT_CONSTRUCTOR_EXIT,
  EVENT_EXECUTE_ANONYMOUS,
  EVENT_METHOD_ENTRY,
  EVENT_METHOD_EXIT,
  EVENT_STATEMENT_EXECUTE,
  EVENT_USER_DEBUG,
  EVENT_VARIABLE_ASSIGNMENT,
  EVENT_VARIABLE_SCOPE_BEGIN,
  EVENT_VF_APEX_CALL_END,
  EVENT_VF_APEX_CALL_START,
  EXEC_ANON_SIGNATURE,
  SFDC_TRIGGER
} from '../constants';
import {
  DebugLogState,
  FrameEntryState,
  FrameExitState,
  FrameStateUtil,
  LogEntryState,
  NoOpState,
  StatementExecuteState,
  UserDebugState,
  VariableAssignmentState,
  VariableBeginState
} from '../states';
import { LogContextUtil } from './logContextUtil';

export class LogContext {
  private readonly util = new LogContextUtil();
  private readonly session: ApexReplayDebug;
  private readonly launchArgs: LaunchRequestArguments;
  private readonly logLines: string[] = [];
  private state: DebugLogState | undefined;
  private frameHandles = new Handles<ApexDebugStackFrameInfo>();
  private scopeHandles = new Handles<ScopeContainer>();
  private staticVariablesClassMap = new Map<
    String,
    Map<String, ApexVariable>
  >();
  private variableHandles = new Handles<ApexVariable>();
  private stackFrameInfos: StackFrame[] = [];
  private logLinePosition = -1;
  private execAnonMapping: Map<number, number> = new Map();

  constructor(launchArgs: LaunchRequestArguments, session: ApexReplayDebug) {
    this.launchArgs = launchArgs;
    this.session = session;
    this.logLines = this.util.readLogFile(launchArgs.logFile);
  }

  public getLaunchArgs(): LaunchRequestArguments {
    return this.launchArgs;
  }

  public getSession(): ApexReplayDebug {
    return this.session;
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

  public meetsLogLevelRequirements(): boolean {
    return (
      this.logLines &&
      this.logLines.length > 0 &&
      this.logLines[0].match(
        /\d{2}.*APEX_CODE,FINEST;.*VISUALFORCE,FINER;.*/
      ) !== null
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

  public incrementLogLinePosition(): void {
    this.logLinePosition += 1;
  }

  public getFrames(): StackFrame[] {
    return this.stackFrameInfos;
  }

  public getNumOfFrames(): number {
    return this.stackFrameInfos.length;
  }

  public getTopFrame(): StackFrame | undefined {
    if (this.stackFrameInfos.length > 0) {
      return this.stackFrameInfos[this.stackFrameInfos.length - 1];
    }
  }

  public getStaticVariablesClassMap(): Map<String, Map<String, Variable>> {
    return this.staticVariablesClassMap;
  }

  public getFrameHandler(): Handles<ApexDebugStackFrameInfo> {
    return this.frameHandles;
  }

  public getScopeHandler(): Handles<ScopeContainer> {
    return this.scopeHandles;
  }

  public getVariableHandler(): Handles<ApexVariable> {
    return this.variableHandles;
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
      return this.getLogFilePath();
    }
    const processedSignature = signature.endsWith(')')
      ? signature.substring(
          0,
          signature.substring(0, signature.indexOf('(')).lastIndexOf('.')
        )
      : signature;
    const typerefMapping = this.session.getBreakpointUtil().getTyperefMapping();
    let uri = '';
    typerefMapping.forEach((value, key) => {
      let processedKey = '';
      if (key.startsWith(SFDC_TRIGGER)) {
        processedKey = key;
      } else {
        processedKey = key.replace('/', '.').replace('$', '.');
      }

      if (processedKey === processedSignature) {
        uri = value;
        return;
      }
    });
    return uri;
  }

  public hasFrames(): boolean {
    return this.stackFrameInfos && this.stackFrameInfos.length > 0;
  }

  public updateFrames(): void {
    if (this.state instanceof LogEntryState) {
      this.stackFrameInfos.pop();
    }
    while (++this.logLinePosition < this.logLines.length) {
      const logLine = this.logLines[this.logLinePosition];
      if (logLine) {
        this.setState(this.parseLogEvent(logLine));
        if (
          this.session.shouldTraceLogFile() &&
          !(this.state instanceof UserDebugState)
        ) {
          this.session.printToDebugConsole(logLine);
        }
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
        case EVENT_VF_APEX_CALL_START:
          if (
            FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(
              fields[fields.length - 2]
            )
          ) {
            return new NoOpState();
          } else {
            return new FrameEntryState(fields);
          }
        case EVENT_CODE_UNIT_FINISHED:
        case EVENT_CONSTRUCTOR_EXIT:
        case EVENT_METHOD_EXIT:
          return new FrameExitState(fields);
        case EVENT_VARIABLE_SCOPE_BEGIN:
          return new VariableBeginState(fields);
        case EVENT_VARIABLE_ASSIGNMENT:
          return new VariableAssignmentState(fields);
        case EVENT_VF_APEX_CALL_END:
          if (
            FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(
              fields[fields.length - 2]
            )
          ) {
            return new NoOpState();
          } else {
            return new FrameExitState(fields);
          }
        case EVENT_STATEMENT_EXECUTE:
          if (logLine.match(/.*\|.*\|\[\d{1,}\]/)) {
            fields[2] = this.util.stripBrackets(fields[2]);
            return new StatementExecuteState(fields);
          }
          break;
        case EVENT_USER_DEBUG:
          if (logLine.match(/.*\|.*\|\[\d{1,}\]\|.*\|.*/)) {
            fields[2] = this.util.stripBrackets(fields[2]);
            return new UserDebugState(fields);
          }
          break;
        default:
          return new NoOpState();
      }
    }

    return new NoOpState();
  }
}
