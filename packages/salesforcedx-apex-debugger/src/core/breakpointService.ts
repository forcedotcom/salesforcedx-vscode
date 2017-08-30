/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandExecution,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ApexBreakpointLocation,
  LineBreakpointsInTyperef
} from '../breakpoints/lineBreakpoint';

export class BreakpointService {
  private static instance: BreakpointService;
  private lineNumberMapping: Map<
    string,
    LineBreakpointsInTyperef[]
  > = new Map();
  private breakpointCache: Map<string, ApexBreakpointLocation[]> = new Map();

  public static getInstance() {
    if (!BreakpointService.instance) {
      BreakpointService.instance = new BreakpointService();
    }
    return BreakpointService.instance;
  }

  public setValidLines(
    lineNumberMapping: Map<string, LineBreakpointsInTyperef[]>
  ): void {
    this.lineNumberMapping = lineNumberMapping;
  }

  public hasLineNumberMapping(): boolean {
    return this.lineNumberMapping && this.lineNumberMapping.size > 0;
  }

  public isApexDebuggerBreakpointId(id: string): boolean {
    return id != null && id.startsWith('07b');
  }

  public getTyperefFor(uri: string, line: number): string | undefined {
    const linesInTyperefs = this.lineNumberMapping.get(uri);
    if (linesInTyperefs) {
      for (const linesInTyperef of linesInTyperefs) {
        if (linesInTyperef.lines.indexOf(line) >= 0) {
          return linesInTyperef.typeref;
        }
      }
    }
  }

  public cacheBreakpoint(
    uriArg: string,
    lineArg: number,
    breakpointIdArg: string
  ) {
    if (!this.breakpointCache.has(uriArg)) {
      this.breakpointCache.set(uriArg, []);
    }
    this.breakpointCache.get(uriArg)!.push({
      line: lineArg,
      breakpointId: breakpointIdArg
    });
  }

  public getBreakpointCache(): Map<string, ApexBreakpointLocation[]> {
    return this.breakpointCache;
  }

  public getBreakpointsFor(uri: string): number[] {
    const lines: number[] = [];
    const existingBreakpoints = this.breakpointCache.get(uri);
    if (existingBreakpoints) {
      for (const breakpointInfo of existingBreakpoints) {
        lines.push(breakpointInfo.line);
      }
    }
    return lines;
  }

  public async createLineBreakpoint(
    projectPath: string,
    sessionId: string,
    typeref: string,
    line: number
  ): Promise<string> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:data:record:create')
        .withFlag('--sobjecttype', 'ApexDebuggerBreakpoint')
        .withFlag(
          '--values',
          `SessionId='${sessionId}' FileName='${typeref}' Line=${line} IsEnabled='true' Type='Line'`
        )
        .withArg('--usetoolingapi')
        .withArg('--json')
        .build(),
      { cwd: projectPath }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const breakpointId = JSON.parse(result).result.id as string;
      if (this.isApexDebuggerBreakpointId(breakpointId)) {
        return Promise.resolve(breakpointId);
      } else {
        return Promise.reject(result);
      }
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public async deleteLineBreakpoint(
    projectPath: string,
    breakpointId: string
  ): Promise<string> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:data:record:delete')
        .withFlag('--sobjecttype', 'ApexDebuggerBreakpoint')
        .withFlag('--sobjectid', breakpointId)
        .withArg('--usetoolingapi')
        .withArg('--json')
        .build(),
      { cwd: projectPath }
    ).execute();
    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const deletedBreakpointId = JSON.parse(result).result.id as string;
      if (this.isApexDebuggerBreakpointId(deletedBreakpointId)) {
        return Promise.resolve(deletedBreakpointId);
      } else {
        return Promise.reject(result);
      }
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public async reconcileBreakpoints(
    projectPath: string,
    sessionId: string,
    uri: string,
    clientLines?: number[]
  ): Promise<number[]> {
    const lineBpsStillEnabled: ApexBreakpointLocation[] = [];
    const lineBpsActuallyEnabled = this.breakpointCache.get(uri);
    if (clientLines && clientLines.length > 0 && lineBpsActuallyEnabled) {
      for (
        let serverBpIdx = 0;
        serverBpIdx < lineBpsActuallyEnabled.length;
        serverBpIdx++
      ) {
        const clientLineIdx = clientLines.indexOf(
          lineBpsActuallyEnabled[serverBpIdx].line
        );
        if (clientLineIdx >= 0) {
          lineBpsStillEnabled.push(lineBpsActuallyEnabled[serverBpIdx]);
          clientLines.splice(clientLineIdx, 1);
          lineBpsActuallyEnabled.splice(serverBpIdx, 1);
        }
      }
    }
    if (lineBpsActuallyEnabled && lineBpsActuallyEnabled.length > 0) {
      for (const serverBp of lineBpsActuallyEnabled) {
        await this.deleteLineBreakpoint(projectPath, serverBp.breakpointId);
      }
    }
    this.breakpointCache.set(uri, lineBpsStillEnabled);

    return clientLines ? Promise.resolve(clientLines) : Promise.resolve([]);
  }

  public clearSavedBreakpoints(): void {
    this.breakpointCache.clear();
  }
}
