/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { CancellationTokenSource, RelativePattern, workspace } from 'vscode';
import { provideFunctionInvokeCodeLens as unit } from '../../../../src/commands/functions';
import { getRootWorkspacePath } from '../../../../src/util';

describe('Force Apex Function Invoke Codelens', () => {

  it('should create codelens for a json payload file', async () => {
    const cancellationTokenSource = new CancellationTokenSource();
    workspace.openTextDocument({
      language: 'json'
    }).then(async payloadDoc => {
      const codeLens = await unit(payloadDoc, cancellationTokenSource.token);
      expect(codeLens).to.have.lengthOf(1);
      const [invokeCodeLens] = codeLens;
      expect(invokeCodeLens.range.start.line).to.equal(0);
      expect(invokeCodeLens.range.start.character).to.equal(0);
      expect(invokeCodeLens.range.end.line).to.equal(0);
      expect(invokeCodeLens.range.end.character).to.equal(1);
      expect(invokeCodeLens.command!.command).to.equal(
        'sfdx.force.function.invoke'
      );
    });
  });

  it('should not create codelens for package.json', async () => {
    const files = await workspace.findFiles(
      new RelativePattern(
        getRootWorkspacePath(),
        'package.json'
      )
    );
    const cancellationTokenSource = new CancellationTokenSource();
    const payloadDoc = await workspace.openTextDocument(files[0]);
    const codeLens = await unit(payloadDoc, cancellationTokenSource.token);
    expect(codeLens).to.have.lengthOf(0);
  });
});
