/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ForceOrgDisplay } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  RequestService,
  RestHttpMethodEnum
} from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import * as path from 'path';
import { StackFrame } from 'vscode-debugadapter';
import {
  ApexDebugStackFrameInfo,
  ApexReplayDebug,
  ApexVariableContainer,
  LaunchRequestArguments,
  VariableContainer
} from '../adapter/apexReplayDebug';
import { breakpointUtil } from '../breakpoints';
import {
  ApexExecutionOverlayResultCommand,
  ApexExecutionOverlayResultCommandFailure,
  ApexExecutionOverlayResultCommandSuccess,
  OrgInfoError
} from '../commands';
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
import { nls } from '../messages';
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
import { Handles } from './handles';
import { ApexHeapDump } from './heapDump';
import { LogContextUtil } from './logContextUtil';

export class LogContext {
  private readonly util = new LogContextUtil();
  private readonly session: ApexReplayDebug;
  private readonly launchArgs: LaunchRequestArguments;
  private readonly logLines: string[] = [];
  private state: DebugLogState | undefined;
  private frameHandles = new Handles<ApexDebugStackFrameInfo>();
  private staticVariablesClassMap = new Map<
    string,
    Map<string, ApexVariableContainer>
  >();
  private refsMap = new Map<string, ApexVariableContainer>();
  private variableHandles = new Handles<ApexVariableContainer>();
  private stackFrameInfos: StackFrame[] = [];
  private logLinePosition = -1;
  private execAnonMapping: Map<number, number> = new Map();

  private apexHeapDumps: ApexHeapDump[] = [];
  private backupStackFrameInfos = this.stackFrameInfos;
  private backupFrameHandles = this.frameHandles;
  private backupRefsMap = this.refsMap;
  private backupVariableHandles = this.variableHandles;

  constructor(launchArgs: LaunchRequestArguments, session: ApexReplayDebug) {
    this.launchArgs = launchArgs;
    this.session = session;
    this.logLines = this.util.readLogFile(launchArgs.logFile);
  }

  public getUtil(): LogContextUtil {
    return this.util;
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
        /(\d{2}.*APEX_CODE,FINEST;.*VISUALFORCE,FINER;.*|\d{2}.*APEX_CODE,FINEST;.*VISUALFORCE,FINEST;.*)/
      ) !== null
    );
  }

  public getHeapDumps(): ApexHeapDump[] {
    return this.apexHeapDumps;
  }

  public hasHeapDump(): boolean {
    return this.apexHeapDumps.length > 0;
  }

  public getHeapDumpForThisLocation(
    frameName: string,
    lineNumber: number
  ): ApexHeapDump | undefined {
    for (const heapdump of this.apexHeapDumps) {
      if (
        frameName.includes(heapdump.getClassName()) &&
        lineNumber === heapdump.getLine()
      ) {
        return heapdump;
      }
    }
  }

  public hasHeapDumpForTopFrame(): string | undefined {
    const topFrame = this.getTopFrame();
    if (topFrame) {
      const heapDump = this.getHeapDumpForThisLocation(
        topFrame.name,
        topFrame.line
      );
      if (heapDump) {
        return heapDump.getHeapDumpId();
      }
    }
  }

  public isRunningApexTrigger(): boolean {
    const topFrame = this.getTopFrame();
    if (
      topFrame &&
      topFrame.source &&
      topFrame.source.name.toLowerCase().endsWith('.trigger')
    ) {
      return true;
    }
    return false;
  }

  public copyStateForHeapDump(): void {
    this.backupStackFrameInfos = JSON.parse(
      JSON.stringify(this.stackFrameInfos)
    );
    this.backupFrameHandles = this.frameHandles.copy();
    this.backupRefsMap = new Map<string, ApexVariableContainer>();
    this.backupVariableHandles = new Handles<ApexVariableContainer>();
    for (const backupFrame of this.backupStackFrameInfos) {
      const frameInfo = this.backupFrameHandles.get(backupFrame.id);
      this.copyVariableContainers(frameInfo.locals);
      this.copyVariableContainers(frameInfo.statics);
    }
  }

  private copyVariableContainers(variables: Map<string, VariableContainer>) {
    variables.forEach((value, key) => {
      const variableContainer = value as ApexVariableContainer;
      if (variableContainer.ref) {
        this.backupRefsMap.set(variableContainer.ref, variableContainer);
        const newRef = this.backupVariableHandles.create(variableContainer);
        variableContainer.variablesRef = newRef;
        this.copyVariableContainers(variableContainer.variables);
      }
    });
  }

  public revertStateAfterHeapDump(): void {
    this.stackFrameInfos = this.backupStackFrameInfos;
    this.frameHandles = this.backupFrameHandles;
    this.refsMap = this.backupRefsMap;
    this.variableHandles = this.backupVariableHandles;
  }

  public scanLogForHeapDumpLines(): boolean {
    const heapDumpRegex = RegExp(/\|HEAP_DUMP\|/);
    this.logLines.forEach((line, index) => {
      if (heapDumpRegex.test(line)) {
        const splitLine = line.split('|');
        if (splitLine.length >= 7) {
          const heapDump = new ApexHeapDump(
            splitLine[3] /* heapDumpId */,
            splitLine[4] /* className */,
            splitLine[5] /* namespace */,
            Number(splitLine[6]) /* line */
          );
          this.apexHeapDumps.push(heapDump);
        } else {
          // With the way log lines are, this would only happen
          // if the user manually edited the log file.
          this.session.printToDebugConsole(
            nls.localize('malformed_log_line', index + 1, line)
          );
        }
      }
    });
    return this.apexHeapDumps.length > 0;
  }

  public async fetchOverlayResultsForApexHeapDumps(
    projectPath: string
  ): Promise<boolean> {
    let success = true;
    try {
      const orgInfo = await new ForceOrgDisplay().getOrgInfo(projectPath);
      const requestService = new RequestService();
      requestService.instanceUrl = orgInfo.instanceUrl;
      requestService.accessToken = orgInfo.accessToken;

      for (const heapDump of this.apexHeapDumps) {
        this.session.printToDebugConsole(
          nls.localize('fetching_heap_dump', heapDump.toString())
        );
        const overlayActionCommand = new ApexExecutionOverlayResultCommand(
          heapDump.getHeapDumpId()
        );
        let errorString;
        let returnString;
        await requestService
          .execute(overlayActionCommand, RestHttpMethodEnum.Get)
          .then(
            value => {
              returnString = value;
            },
            reason => {
              errorString = reason;
            }
          );
        if (returnString) {
          heapDump.setOverlaySuccessResult(JSON.parse(
            returnString
          ) as ApexExecutionOverlayResultCommandSuccess);
        } else if (errorString) {
          try {
            success = false;
            const error = JSON.parse(
              errorString
            ) as ApexExecutionOverlayResultCommandFailure[];
            const errorMessage = nls.localize(
              'heap_dump_error',
              error[0].message,
              error[0].errorCode,
              heapDump.toString()
            );
            this.session.errorToDebugConsole(errorMessage);
          } catch (error) {
            const errorMessage = `${error}. ${errorString}. ${heapDump.toString()}`;
            this.session.errorToDebugConsole(errorMessage);
          }
        }
      }
    } catch (error) {
      success = false;
      const result = JSON.parse(error) as OrgInfoError;
      const errorMessage = `${nls.localize(
        'unable_to_retrieve_org_info'
      )} : ${result.message}`;
      this.session.errorToDebugConsole(errorMessage);
    }
    return success;
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

  public getRefsMap(): Map<string, ApexVariableContainer> {
    return this.refsMap;
  }

  public getStaticVariablesClassMap(): Map<
    string,
    Map<string, VariableContainer>
  > {
    return this.staticVariablesClassMap;
  }

  public getFrameHandler(): Handles<ApexDebugStackFrameInfo> {
    return this.frameHandles;
  }

  public getVariableHandler(): Handles<VariableContainer> {
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
    const typerefMapping = breakpointUtil.getTyperefMapping();
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
    if (this.hasHeapDump()) {
      this.revertStateAfterHeapDump();
    }
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
