/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DebugProtocol } from 'vscode-debugprotocol';
export class BreakpointUtil {
  private static instance: BreakpointUtil;
  private lineNumberMapping: Map<string, number[]> = new Map();
  private typerefMapping: Map<string, string> = new Map();
  private rawLineBPInfo: any | undefined;

  public setValidLines(
    lineNumberMapping: Map<string, number[]>,
    typerefMapping: Map<string, string>
  ): void {
    this.lineNumberMapping = lineNumberMapping;
    this.typerefMapping = typerefMapping;
  }

  public static getInstance(): BreakpointUtil {
    if (!BreakpointUtil.instance) {
      BreakpointUtil.instance = new BreakpointUtil();
    }
    return BreakpointUtil.instance;
  }

  public static setInstance(inputInstance: BreakpointUtil): void {
    BreakpointUtil.instance = inputInstance;
  }

  public hasLineNumberMapping(): boolean {
    return this.lineNumberMapping && this.lineNumberMapping.size > 0;
  }

  public getLineNumberMapping(): Map<string, number[]> {
    return this.lineNumberMapping;
  }

  public getTyperefMapping(): Map<string, string> {
    return this.typerefMapping;
  }

  public canSetLineBreakpoint(uri: string, line: number): boolean {
    return (
      this.lineNumberMapping.has(uri) &&
      this.lineNumberMapping.get(uri)!.indexOf(line) !== -1
    );
  }

  public getRawLineBPInfo(): any | undefined {
    return this.rawLineBPInfo;
  }

  public createMappingsFromLineBreakpointInfo(lineBpInfo: any): void {
    this.rawLineBPInfo = lineBpInfo;
    for (const info of lineBpInfo) {
      if (!this.lineNumberMapping.has(info.uri)) {
        this.lineNumberMapping.set(info.uri, []);
      }
      this.lineNumberMapping.set(
        info.uri,
        this.lineNumberMapping.get(info.uri)!.concat(info.lines)
      );
      this.typerefMapping.set(info.typeref, info.uri);
    }
  }

  public returnLinesForLoggingFromBreakpointArgs(
    bpArr: DebugProtocol.SourceBreakpoint[]
  ): string {
    let returnVal = '';

    for (let i = 0; i < bpArr.length - 2; i++) {
      returnVal += bpArr[i].line + ',';
    }
    returnVal += bpArr[bpArr.length - 1].line;
    return returnVal;
  }

  public getTopLevelTyperefForUri(uriInput: string): string {
    let returnValue = '';
    this.typerefMapping.forEach((value, key) => {
      if (value === uriInput) {
        if (key.indexOf('$') === -1) {
          returnValue = key;
          return;
        }
      }
    });
    return returnValue;
  }
}
