/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import { DebugClient } from 'vscode-debugadapter-testsupport';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';

export class GoldFileUtil {
  private readonly delimiter = '====================';
  private readonly dc: DebugClient;
  private readonly goldFilePath: string;
  private golds: string[] = [];
  private goldIndex: number = 0;

  constructor(dc: DebugClient, goldFilePath: string) {
    this.dc = dc;
    this.goldFilePath = goldFilePath;
    this.golds = fs
      .readFileSync(this.goldFilePath, 'utf-8')
      .split(this.delimiter);
    this.golds = this.golds.map(gold => {
      return gold.trim();
    });
  }

  public close(): void {
    fs.writeFileSync(this.goldFilePath, this.golds.join('\n'), 'utf-8');
  }

  public async assertTopState(
    stoppedReason: string,
    stoppedFilePath: string,
    stoppedLine: number
  ): Promise<void> {
    const stackTraceResponse = await this.assertStackTrace(
      stoppedReason,
      stoppedFilePath,
      stoppedLine
    );

    const scopesResponse = await this.dc.scopesRequest({
      frameId: stackTraceResponse.body.stackFrames[0].id
    });
    expect(scopesResponse.body.scopes.length).to.equal(2);
    expect(scopesResponse.body.scopes[0].name).to.equal('Local');
    expect(scopesResponse.body.scopes[1].name).to.equal('Static');

    const localScope = scopesResponse.body.scopes[0];
    await this.assertVariables(localScope);

    const staticScope = scopesResponse.body.scopes[1];
    await this.assertVariables(staticScope);
  }

  public async assertEntireState(
    stoppedReason: string,
    stoppedFilePath: string,
    stoppedLine: number
  ): Promise<void> {
    const stackTraceResponse = await this.assertStackTrace(
      stoppedReason,
      stoppedFilePath,
      stoppedLine
    );

    for (const frame of stackTraceResponse.body.stackFrames) {
      const scopesResponse = await this.dc.scopesRequest({
        frameId: frame.id
      });
      expect(scopesResponse.body.scopes.length).to.equal(2);
      expect(scopesResponse.body.scopes[0].name).to.equal('Local');
      expect(scopesResponse.body.scopes[1].name).to.equal('Static');

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
    const stackTraceResponse = await this.dc.assertStoppedLocation(
      stoppedReason,
      {
        path: stoppedFilePath,
        line: stoppedLine
      }
    );
    stackTraceResponse.body.stackFrames.forEach(frame => {
      if (frame.source && frame.source.path) {
        frame.source.path = '<redacted>';
      }
    });
    const actualStack = JSON.stringify(
      stackTraceResponse.body.stackFrames,
      null,
      2
    );
    this.compareGoldValue(actualStack);
    return stackTraceResponse;
  }

  private async assertVariables(scope: DebugProtocol.Scope) {
    const variablesResponse = await this.dc.variablesRequest({
      variablesReference: scope.variablesReference
    });
    const actualVariables = JSON.stringify(
      variablesResponse.body.variables,
      null,
      2
    );
    this.compareGoldValue(actualVariables);
  }

  private compareGoldValue(actual: string) {
    if (this.goldIndex < this.golds.length) {
      const expected = this.golds[this.goldIndex++];
      expect(actual).to.equal(expected);
    }
  }
}
