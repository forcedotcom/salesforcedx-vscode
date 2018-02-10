/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export class BreakpointUtil {
  private lineNumberMapping: Map<string, number[]> = new Map();
  private typerefMapping: Map<string, string> = new Map();

  public setValidLines(
    lineNumberMapping: Map<string, number[]>,
    typerefMapping: Map<string, string>
  ): void {
    this.lineNumberMapping = lineNumberMapping;
    this.typerefMapping = typerefMapping;
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
}
