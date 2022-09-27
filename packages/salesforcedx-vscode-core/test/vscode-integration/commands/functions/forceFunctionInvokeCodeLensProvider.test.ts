/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { CancellationTokenSource, RelativePattern, workspace } from 'vscode';
import { provideFunctionInvokeCodeLens } from '../../../../src/commands/functions';
import { workspaceUtils } from '../../../../src/util';

describe('Force Function Invoke Codelens', () => {
  it('should create codelens for a json payload file', async () => {
    const cancellationTokenSource = new CancellationTokenSource();
    return workspace
      .openTextDocument({
        language: 'json'
      })
      .then(async payloadDoc => {
        const codeLens = await provideFunctionInvokeCodeLens(
          payloadDoc,
          cancellationTokenSource.token
        );
        expect(codeLens).to.have.lengthOf(2);
        const [invokeCodeLens, debugInvokeCodeLens] = codeLens;
        expect(invokeCodeLens.range.start.line).to.equal(0);
        expect(invokeCodeLens.range.start.character).to.equal(0);
        expect(invokeCodeLens.range.end.line).to.equal(0);
        expect(invokeCodeLens.range.end.character).to.equal(1);
        expect(invokeCodeLens.command!.command).to.equal(
          'sfdx.force.function.invoke'
        );

        expect(debugInvokeCodeLens.range.start.line).to.equal(0);
        expect(debugInvokeCodeLens.range.start.character).to.equal(0);
        expect(debugInvokeCodeLens.range.end.line).to.equal(0);
        expect(debugInvokeCodeLens.range.end.character).to.equal(1);
        expect(debugInvokeCodeLens.command!.command).to.equal(
          'sfdx.force.function.debugInvoke'
        );
      });
  });

  it('should not create codelens for non payload jsons', async () => {
    const files = await workspace.findFiles(
      new RelativePattern(
        workspaceUtils.getRootWorkspacePath(),
        'functions/demoJavaScriptFunction/package.json'
      )
    );
    const cancellationTokenSource = new CancellationTokenSource();
    const payloadDoc = await workspace.openTextDocument(files[0]);
    const codeLens = await provideFunctionInvokeCodeLens(
      payloadDoc,
      cancellationTokenSource.token
    );
    expect(codeLens).to.have.lengthOf(0);
  });
});
