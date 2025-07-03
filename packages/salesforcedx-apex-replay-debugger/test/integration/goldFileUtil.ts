/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile, writeFile } from '@salesforce/salesforcedx-utils-vscode';
import { DebugClient } from '@vscode/debugadapter-testsupport';
import { DebugProtocol } from '@vscode/debugprotocol/lib/debugProtocol';

export class GoldFileUtil {
  private readonly dc: DebugClient;
  private readonly goldFilePath: string;
  private golds: string[] = [];
  private goldIndex: number = 0;

  private constructor(dc: DebugClient, goldFilePath: string, golds: string[]) {
    this.dc = dc;
    this.goldFilePath = goldFilePath;
    this.golds = golds;
  }

  public static async create(dc: DebugClient, goldFilePath: string): Promise<GoldFileUtil> {
    const content = await readFile(goldFilePath);
    const golds = content.split('====================').map(gold => gold.trim());
    return new GoldFileUtil(dc, goldFilePath, golds);
  }

  public async close(): Promise<void> {
    await writeFile(this.goldFilePath, this.golds.join('\n'));
  }

  public async assertTopState(stoppedReason: string, stoppedFilePath: string, stoppedLine: number): Promise<void> {
    const stackTraceResponse = await this.assertStackTrace(stoppedReason, stoppedFilePath, stoppedLine);

    const scopesResponse = await this.dc.scopesRequest({
      frameId: stackTraceResponse.body.stackFrames[0].id
    });
    expect(scopesResponse.body.scopes).toHaveLength(3);
    expect(scopesResponse.body.scopes[0].name).toBe('Local');
    expect(scopesResponse.body.scopes[1].name).toBe('Static');
    expect(scopesResponse.body.scopes[2].name).toBe('Global');

    const localScope = scopesResponse.body.scopes[0];
    await this.assertVariables(localScope);

    const staticScope = scopesResponse.body.scopes[1];
    await this.assertVariables(staticScope);
  }

  public async assertEntireState(stoppedReason: string, stoppedFilePath: string, stoppedLine: number): Promise<void> {
    const stackTraceResponse = await this.assertStackTrace(stoppedReason, stoppedFilePath, stoppedLine);

    for (const frame of stackTraceResponse.body.stackFrames) {
      const scopesResponse = await this.dc.scopesRequest({
        frameId: frame.id
      });
      expect(scopesResponse.body.scopes).toHaveLength(3);
      expect(scopesResponse.body.scopes[0].name).toBe('Local');
      expect(scopesResponse.body.scopes[1].name).toBe('Static');
      expect(scopesResponse.body.scopes[2].name).toBe('Global');

      const localScope = scopesResponse.body.scopes[0];
      await this.assertVariables(localScope);

      const staticScope = scopesResponse.body.scopes[1];
      await this.assertVariables(staticScope);
    }
  }

  private async assertStackTrace(
    stoppedReason: string,
    stoppedFilePath: string,
    stoppedLine: number
  ): Promise<DebugProtocol.StackTraceResponse> {
    const stackTraceResponse = await this.dc.assertStoppedLocation(stoppedReason, {
      path: stoppedFilePath,
      line: stoppedLine
    });
    stackTraceResponse.body.stackFrames.forEach(frame => {
      if (frame.source?.path) {
        frame.source.path = '<redacted>';
      }
    });
    const actualStack = JSON.stringify(stackTraceResponse.body.stackFrames, null, 2);
    this.compareGoldValue(actualStack);
    return stackTraceResponse;
  }

  private async assertVariables(scope: DebugProtocol.Scope) {
    const variablesResponse = await this.dc.variablesRequest({
      variablesReference: scope.variablesReference
    });
    const actualVariables = JSON.stringify(variablesResponse.body.variables, null, 2);
    this.compareGoldValue(actualVariables);
  }

  private compareGoldValue(actual: string) {
    if (this.goldIndex < this.golds.length) {
      const expected = this.golds[this.goldIndex++];
      expect(actual).toBe(expected);
    }
  }
}
