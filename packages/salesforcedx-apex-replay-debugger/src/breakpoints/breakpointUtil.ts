/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import { DebugProtocol } from '@vscode/debugprotocol';

export class BreakpointUtil {
  public lineNumberMapping: Map<string, number[]> = new Map();
  public typerefMapping: Map<string, string> = new Map();

  public canSetLineBreakpoint(uri: string, line: number): boolean {
    return this.lineNumberMapping.has(uri) && this.lineNumberMapping.get(uri)!.includes(line);
  }

  public createMappingsFromLineBreakpointInfo(lineBpInfo: LineBreakpointInfo[]): void {
    // clear out any existing mapping
    this.lineNumberMapping.clear();
    this.typerefMapping.clear();

    // set the mapping from the source line info
    for (const info of lineBpInfo) {
      if (!this.lineNumberMapping.has(info.uri)) {
        this.lineNumberMapping.set(info.uri, []);
      }
      this.lineNumberMapping.set(info.uri, this.lineNumberMapping.get(info.uri)!.concat(info.lines));
      this.typerefMapping.set(info.typeref, info.uri);
    }
  }

  public getTopLevelTyperefForUri(uriInput: string): string {
    let returnValue = '';
    this.typerefMapping.forEach((value, key) => {
      if (value === uriInput) {
        if (!key.includes('$')) {
          returnValue = key;
        }
      }
    });
    return returnValue;
  }
}

export const breakpointUtil = new BreakpointUtil();

export const returnLinesForLoggingFromBreakpointArgs = (bpArr: DebugProtocol.SourceBreakpoint[]): string =>
  bpArr.map(bp => bp.line).join(',');
