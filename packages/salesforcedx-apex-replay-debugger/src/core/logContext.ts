/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator, Org } from '@salesforce/core';
import { StackFrame } from '@vscode/debugadapter';
import { ApexDebugStackFrameInfo } from '../adapter/apexDebugStackFrameInfo';
import { ApexReplayDebug } from '../adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../adapter/types';
import { ApexVariableContainer } from '../adapter/variableContainer';
import { breakpointUtil } from '../breakpoints/breakpointUtil';
import {
  EVENT_CODE_UNIT_FINISHED,
  EVENT_CODE_UNIT_STARTED,
  EVENT_CONSTRUCTOR_ENTRY,
  EVENT_CONSTRUCTOR_EXIT,
  EVENT_EXECUTE_ANONYMOUS,
  EVENT_HEAP_DUMP,
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
  LogEntryState,
  NoOpState,
  StatementExecuteState,
  UserDebugState,
  VariableAssignmentState,
  VariableBeginState
} from '../states';
import { isExtraneousVFGetterOrSetterLogLine } from '../states/frameStateUtil';
import { ApexExecutionOverlayResult } from '../types/apexExecutionOverlayResultCommand';
import { Handles } from './handles';
import { ApexHeapDump, stringifyHeapDump } from './heapDump';
import { readLogFileFromContents, stripBrackets, getFileSizeFromContents } from './logContextUtil';

export class LogContext {
  private readonly session: ApexReplayDebug;
  private readonly launchArgs: LaunchRequestArguments;
  private readonly logLines: string[] = [];
  private readonly logSize: number;
  private state: DebugLogState | undefined;
  private frameHandles = new Handles<ApexDebugStackFrameInfo>();
  private staticVariablesClassMap = new Map<string, Map<string, ApexVariableContainer>>();
  private refsMap = new Map<string, ApexVariableContainer>();
  private variableHandles = new Handles<ApexVariableContainer>();
  private stackFrameInfos: StackFrame[] = [];
  private logLinePosition = -1;
  private execAnonMapping: Map<number, number> = new Map();
  private apexHeapDumps: ApexHeapDump[] = [];
  private lastSeenHeapDumpClass = '';
  private lastSeenHeapDumpLine = -1;
  private backupStackFrameInfos = this.stackFrameInfos;
  private backupFrameHandles = this.frameHandles;
  private backupRefsMap = this.refsMap;
  private backupStaticVariablesClassMap = this.staticVariablesClassMap;
  private backupVariableHandles = this.variableHandles;

  constructor(launchArgs: LaunchRequestArguments, session: ApexReplayDebug) {
    this.launchArgs = launchArgs;
    this.session = session;
    this.logLines = readLogFileFromContents(launchArgs.logFileContents);
    this.logSize = getFileSizeFromContents(launchArgs.logFileContents);
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

  public getLogSize(): number {
    return this.logSize;
  }

  public hasLogLines(): boolean {
    return this.logLines && this.logLines.length > 0 && this.logLinePosition < this.logLines.length;
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

  public getHeapDumpForThisLocation(frameName: string, lineNumber: number): ApexHeapDump | undefined {
    return this.apexHeapDumps.find(heapdump => frameName.includes(heapdump.className) && lineNumber === heapdump.line);
  }

  public hasHeapDumpForTopFrame(): string | undefined {
    const topFrame = this.getTopFrame();
    if (topFrame) {
      const heapDump = this.getHeapDumpForThisLocation(topFrame.name, topFrame.line);
      if (
        heapDump &&
        topFrame.name.includes(this.lastSeenHeapDumpClass) &&
        topFrame.line === this.lastSeenHeapDumpLine
      ) {
        return heapDump.heapDumpId;
      }
    }
  }

  public resetLastSeenHeapDumpLogLine(): void {
    this.lastSeenHeapDumpClass = '';
    this.lastSeenHeapDumpLine = -1;
  }

  public isRunningApexTrigger(): boolean {
    return this.getTopFrame()?.source?.name?.toLowerCase().endsWith('.trigger') ?? false;
  }

  public copyStateForHeapDump(): void {
    this.backupStackFrameInfos = JSON.parse(JSON.stringify(this.stackFrameInfos));
    this.backupFrameHandles = this.frameHandles.copy();
    this.backupRefsMap = new Map<string, ApexVariableContainer>();
    this.backupVariableHandles = new Handles<ApexVariableContainer>();
    this.cloneStaticVariablesClassMap();
    this.backupStackFrameInfos
      .map(backup => this.backupFrameHandles.get(backup.id))
      .filter(frameInfo => frameInfo !== undefined)
      .map(frameInfo => {
        this.copyVariableContainers(frameInfo.locals);
        this.copyVariableContainers(frameInfo.statics);
      });
  }

  private copyVariableContainers(variables: Map<string, ApexVariableContainer>) {
    Array.from(variables.values())
      .filter(apexContainerHasRef)
      .map(variableContainer => {
        this.backupRefsMap.set(variableContainer.ref, variableContainer);
        const newRef = this.backupVariableHandles.create(variableContainer);
        variableContainer.variablesRef = newRef;
        this.copyVariableContainers(variableContainer.variables);
      });
  }

  private cloneStaticVariablesClassMap() {
    this.backupStaticVariablesClassMap = new Map<string, Map<string, ApexVariableContainer>>();
    this.staticVariablesClassMap.forEach((value, key) => {
      const varMap = value;
      const newMap = new Map<string, ApexVariableContainer>();
      varMap.forEach((innerValue, innerKey) => {
        const variable = innerValue;
        newMap.set(innerKey, variable.copy());
      });
      this.backupStaticVariablesClassMap.set(key, newMap);
    });
  }

  public revertStateAfterHeapDump(): void {
    this.staticVariablesClassMap = this.backupStaticVariablesClassMap;
    this.stackFrameInfos = this.backupStackFrameInfos;
    this.frameHandles = this.backupFrameHandles;
    this.refsMap = this.backupRefsMap;
    this.variableHandles = this.backupVariableHandles;
  }

  public scanLogForHeapDumpLines(): boolean {
    const heapDumpRegex = RegExp(/\|HEAP_DUMP\|/);
    this.apexHeapDumps = this.logLines
      .filter(line => heapDumpRegex.test(line))
      .map(line => line.split('|'))
      .filter((splitLine, index) => {
        if (splitLine.length >= 7) {
          return true;
        } else {
          this.session.printToDebugConsole(nls.localize('malformed_log_line', index + 1, splitLine.join('|')));
          return false;
        }
      })
      .map(splitLine => ({
        heapDumpId: splitLine[3],
        className: splitLine[4],
        namespace: splitLine[5],
        line: Number(splitLine[6])
      }));

    return this.apexHeapDumps.length > 0;
  }

  public async fetchOverlayResultsForApexHeapDumps(): Promise<boolean> {
    try {
      // we can't use the core/services extensions via `getExtension` because debug adapters are not extensions
      const configAggregator = await ConfigAggregator.create({ projectPath: this.launchArgs.projectPath });
      const aliasOrUsername = configAggregator.getPropertyValue<string>('target-org');
      if (!aliasOrUsername) {
        throw new Error(nls.localize('unable_to_retrieve_org_info'));
      }
      const conn = (await Org.create({ aliasOrUsername })).getConnection();

      this.session.printToDebugConsole(
        nls.localize('fetching_heap_dump', this.apexHeapDumps.map(h => stringifyHeapDump(h)).join(', '))
      );

      // jsforce tooling types don't have types for any of the "overlay" stuff
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const results = (await conn.tooling
        .sobject('ApexExecutionOverlayResult')
        .retrieve(this.apexHeapDumps.map(h => h.heapDumpId))) as unknown as ApexExecutionOverlayResult[];

      results.map(r => {
        const match = this.apexHeapDumps.find(h => h.heapDumpId === r.Id);
        if (match) {
          match.overlaySuccessResult = r;
        }
      });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message) {
        this.session.errorToDebugConsole(error.message);
      }
      return false;
    }
  }

  public getLogFileName(): string {
    return this.launchArgs.logFileName;
  }

  public getLogFilePath(): string {
    return this.launchArgs.logFilePath;
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
      return this.stackFrameInfos.at(-1);
    }
  }

  public getRefsMap(): Map<string, ApexVariableContainer> {
    return this.refsMap;
  }

  public getStaticVariablesClassMap(): Map<string, Map<string, ApexVariableContainer>> {
    return this.staticVariablesClassMap;
  }

  public getFrameHandler(): Handles<ApexDebugStackFrameInfo> {
    return this.frameHandles;
  }

  public getVariableHandler(): Handles<ApexVariableContainer> {
    return this.variableHandles;
  }

  public setState(state: DebugLogState | undefined): void {
    this.state = state;
  }

  public hasState(): boolean {
    return this.state !== undefined;
  }

  public getExecAnonScriptLocationInDebugLog(scriptLine: number): number {
    return this.execAnonMapping.get(scriptLine) ?? 0;
  }

  public getExecAnonScriptMapping(): Map<number, number> {
    return this.execAnonMapping;
  }

  public getUriFromSignature(signature: string): string {
    if (signature === EXEC_ANON_SIGNATURE) {
      return this.getLogFilePath();
    }
    const processedSignature = signature.endsWith(')')
      ? signature.substring(0, signature.substring(0, signature.indexOf('(')).lastIndexOf('.'))
      : signature;
    const typerefMapping = breakpointUtil.typerefMapping;
    let uri = '';
    typerefMapping.forEach((value, key) => {
      const processedKey = key.startsWith(SFDC_TRIGGER) ? key : key.replace('/', '.').replace('$', '.');
      if (processedKey === processedSignature) {
        uri = value;
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
        if (this.session.shouldTraceLogFile() && !(this.state instanceof UserDebugState)) {
          this.session.printToDebugConsole(logLine);
        }
        if (this.state?.handle(this)) {
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
      this.execAnonMapping.set(this.execAnonMapping.size + 1, this.logLinePosition + 1);
    }
    const fields = logLine.split('|');
    if (fields.length >= 3) {
      // this check makes several ! assertions below allowable
      switch (fields[1]) {
        case EVENT_CODE_UNIT_STARTED:
        case EVENT_CONSTRUCTOR_ENTRY:
        case EVENT_METHOD_ENTRY:
          return new FrameEntryState(fields);
        case EVENT_VF_APEX_CALL_START:
          return isExtraneousVFGetterOrSetterLogLine(fields.at(-2)!) ? new NoOpState() : new FrameEntryState(fields);
        case EVENT_CODE_UNIT_FINISHED:
        case EVENT_CONSTRUCTOR_EXIT:
        case EVENT_METHOD_EXIT:
          return new FrameExitState(fields);
        case EVENT_VARIABLE_SCOPE_BEGIN:
          return new VariableBeginState(fields);
        case EVENT_VARIABLE_ASSIGNMENT:
          return new VariableAssignmentState(fields);
        case EVENT_VF_APEX_CALL_END:
          return isExtraneousVFGetterOrSetterLogLine(fields.at(-2)!) ? new NoOpState() : new FrameExitState(fields);
        case EVENT_STATEMENT_EXECUTE:
          if (logLine.match(/.*\|.*\|\[\d{1,}\]/)) {
            fields[2] = stripBrackets(fields[2]);
            return new StatementExecuteState(fields);
          }
          break;
        case EVENT_USER_DEBUG:
          if (logLine.match(/.*\|.*\|\[\d{1,}\]\|.*\|.*/)) {
            fields[2] = stripBrackets(fields[2]);
            return new UserDebugState(fields);
          }
          break;
        case EVENT_HEAP_DUMP:
          if (logLine.match(/.+\|HEAP_DUMP|\[\d+\]|.+\|.+\|\d+/)) {
            const splitLine = logLine.split('|');
            this.lastSeenHeapDumpClass = splitLine[4];
            this.lastSeenHeapDumpLine = Number(splitLine[6]);
          }
          break;
        default:
          return new NoOpState();
      }
    }

    return new NoOpState();
  }
}

const apexContainerHasRef = (obj: ApexVariableContainer): obj is ApexVariableContainer & { ref: string } =>
  obj instanceof ApexVariableContainer && typeof obj.ref === 'string';
