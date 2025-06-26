/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, CommandOutput, RequestService, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { ExceptionBreakpointInfo } from '../breakpoints/exceptionBreakpoint';
import { ApexBreakpointLocation, LineBreakpointsInTyperef } from '../breakpoints/lineBreakpoint';

export const DEBUGGER_BREAKPOINT_ID_PREFIX = '07b';

export class BreakpointService {
  private lineNumberMapping: Map<string, LineBreakpointsInTyperef[]> = new Map();
  private typerefMapping: Map<string, string> = new Map();
  private lineBreakpointCache: Map<string, ApexBreakpointLocation[]> = new Map();
  private exceptionBreakpointCache: Map<string, string> = new Map();
  private readonly requestService: RequestService;

  constructor(requestService: RequestService) {
    this.requestService = requestService;
  }

  public setValidLines(
    lineNumberMapping: Map<string, LineBreakpointsInTyperef[]>,
    typerefMapping: Map<string, string>
  ): void {
    this.lineNumberMapping = lineNumberMapping;
    this.typerefMapping = typerefMapping;
  }

  public hasLineNumberMapping(): boolean {
    return this.lineNumberMapping && this.lineNumberMapping.size > 0;
  }

  public isApexDebuggerBreakpointId(id: string): boolean {
    return id?.startsWith(DEBUGGER_BREAKPOINT_ID_PREFIX) ?? false;
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

  public getSourcePathFromTyperef(typeref: string): string | undefined {
    return this.typerefMapping.get(typeref);
  }

  public getSourcePathFromPartialTyperef(partialTyperef: string): string | undefined {
    for (const typeref of this.typerefMapping.keys()) {
      if (typeref.endsWith(partialTyperef)) {
        return this.typerefMapping.get(typeref);
      }
    }
  }

  public cacheLineBreakpoint(uriArg: string, lineArg: number, breakpointIdArg: string) {
    if (!this.lineBreakpointCache.has(uriArg)) {
      this.lineBreakpointCache.set(uriArg, []);
    }
    this.lineBreakpointCache.get(uriArg)!.push({
      line: lineArg,
      breakpointId: breakpointIdArg
    });
  }

  public getLineBreakpointCache(): Map<string, ApexBreakpointLocation[]> {
    return this.lineBreakpointCache;
  }

  public getExceptionBreakpointCache(): Map<string, string> {
    return this.exceptionBreakpointCache;
  }

  public getBreakpointsFor(uri: string): Set<number> {
    const lines: Set<number> = new Set();
    const existingBreakpoints = this.lineBreakpointCache.get(uri);
    if (existingBreakpoints) {
      for (const breakpointInfo of existingBreakpoints) {
        lines.add(breakpointInfo.line);
      }
    }
    return lines;
  }

  public async createLineBreakpoint(
    projectPath: string,
    sessionId: string,
    typeref: string,
    line: number
  ): Promise<string | undefined> {
    const execution = new CliCommandExecutor(
      new SfCommandBuilder()
        .withArg('data:create:record')
        .withFlag('--sobject', 'ApexDebuggerBreakpoint')
        .withFlag(
          '--values',
          `SessionId='${sessionId}' FileName='${typeref}' Line=${line} IsEnabled='true' Type='Line'`
        )
        .withArg('--use-tooling-api')
        .withJson()
        .build(),
      { cwd: projectPath, env: this.requestService.getEnvVars() }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const breakpointId = JSON.parse(result).result.id as string;
      return this.isApexDebuggerBreakpointId(breakpointId) ? Promise.resolve(breakpointId) : Promise.reject(result);
    } catch {
      return Promise.reject(result);
    }
  }

  public async deleteBreakpoint(projectPath: string, breakpointId: string): Promise<string | undefined> {
    const execution = new CliCommandExecutor(
      new SfCommandBuilder()
        .withArg('data:delete:record')
        .withFlag('--sobject', 'ApexDebuggerBreakpoint')
        .withFlag('--record-id', breakpointId)
        .withArg('--use-tooling-api')
        .withJson()
        .build(),
      { cwd: projectPath, env: this.requestService.getEnvVars() }
    ).execute();
    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const deletedBreakpointId = JSON.parse(result).result.id as string;
      return this.isApexDebuggerBreakpointId(deletedBreakpointId)
        ? Promise.resolve(deletedBreakpointId)
        : Promise.reject(result);
    } catch {
      return Promise.reject(result);
    }
  }

  public async reconcileLineBreakpoints(
    projectPath: string,
    uri: string,
    sessionId: string,
    clientLines: number[]
  ): Promise<Set<number>> {
    const knownBreakpoints = this.lineBreakpointCache.get(uri);
    if (knownBreakpoints) {
      for (let knownBpIdx = knownBreakpoints.length - 1; knownBpIdx >= 0; knownBpIdx--) {
        const knownBp = knownBreakpoints[knownBpIdx];
        if (clientLines.indexOf(knownBp.line) === -1) {
          try {
            const breakpointId = await this.deleteBreakpoint(projectPath, knownBp.breakpointId);
            if (breakpointId) {
              knownBreakpoints.splice(knownBpIdx, 1);
            }
          } catch {}
        }
      }
    }
    for (const clientLine of clientLines) {
      if (!knownBreakpoints?.find(knownBreakpoint => knownBreakpoint.line === clientLine)) {
        const typeref = this.getTyperefFor(uri, clientLine);
        if (typeref) {
          try {
            const breakpointId = await this.createLineBreakpoint(projectPath, sessionId, typeref, clientLine);
            if (breakpointId) {
              this.cacheLineBreakpoint(uri, clientLine, breakpointId);
            }
          } catch {}
        }
      }
    }
    return Promise.resolve(this.getBreakpointsFor(uri));
  }

  public async createExceptionBreakpoint(
    projectPath: string,
    sessionId: string,
    typeref: string
  ): Promise<string | undefined> {
    const execution = new CliCommandExecutor(
      new SfCommandBuilder()
        .withArg('data:create:record')
        .withFlag('--sobject', 'ApexDebuggerBreakpoint')
        .withFlag('--values', `SessionId='${sessionId}' FileName='${typeref}' IsEnabled='true' Type='Exception'`)
        .withArg('--use-tooling-api')
        .withJson()
        .build(),
      { cwd: projectPath, env: this.requestService.getEnvVars() }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const breakpointId = JSON.parse(result).result.id as string;
      return this.isApexDebuggerBreakpointId(breakpointId) ? Promise.resolve(breakpointId) : Promise.reject(result);
    } catch {
      return Promise.reject(result);
    }
  }

  public async reconcileExceptionBreakpoints(
    projectPath: string,
    sessionId: string,
    info: ExceptionBreakpointInfo
  ): Promise<void> {
    const knownBreakpointId = this.exceptionBreakpointCache.get(info.typeref);
    if (knownBreakpointId && info.breakMode === 'never') {
      await this.deleteBreakpoint(projectPath, knownBreakpointId);
      this.exceptionBreakpointCache.delete(info.typeref);
    } else if (!knownBreakpointId && info.breakMode === 'always') {
      const createdBreakpointId = await this.createExceptionBreakpoint(projectPath, sessionId, info.typeref);
      if (createdBreakpointId) {
        this.exceptionBreakpointCache.set(info.typeref, createdBreakpointId);
      }
    }
  }
}
