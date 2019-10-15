/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import {
  CancellationTokenSource,
  RelativePattern,
  Uri,
  workspace
} from 'vscode';
import { nls } from '../../../../src/messages';
import { provideLwcTestCodeLens } from '../../../../src/testSupport/codeLens/provideLwcTestCodeLens';

describe('Provide LWC Test CodeLens', () => {
  let lwcTests: Uri[];

  before(async () => {
    lwcTests = await workspace.findFiles(
      new RelativePattern(
        workspace.workspaceFolders![0],
        '**/lwc/**/demoLwcComponent.test.js'
      )
    );
  });

  it('Should provide CodeLens', async () => {
    const lwcTestDocument = await workspace.openTextDocument(lwcTests[0]);
    const cancellationTokenSource = new CancellationTokenSource();
    const codeLens = await provideLwcTestCodeLens(
      lwcTestDocument,
      cancellationTokenSource.token
    );
    expect(codeLens).to.have.lengthOf(2);
    const [runTestCodeLens, debugTestCodeLens] = codeLens;
    expect(runTestCodeLens.range.start.line).to.equal(11);
    expect(runTestCodeLens.range.start.character).to.equal(6);
    expect(runTestCodeLens.range.end.line).to.equal(11);
    expect(runTestCodeLens.range.end.character).to.equal(22);
    expect(runTestCodeLens.command!.command).to.equal(
      'sfdx.force.lightning.lwc.test.case.run'
    );
    expect(runTestCodeLens.command!.title).to.equal(
      nls.localize('run_test_title')
    );
    expect(runTestCodeLens.command!.arguments![0].testName).to.equal(
      'Displays greeting'
    );

    expect(debugTestCodeLens.range.start.line).to.equal(11);
    expect(debugTestCodeLens.range.start.character).to.equal(6);
    expect(debugTestCodeLens.range.end.line).to.equal(11);
    expect(debugTestCodeLens.range.end.character).to.equal(22);
    expect(debugTestCodeLens.command!.command).to.equal(
      'sfdx.force.lightning.lwc.test.case.debug'
    );
    expect(debugTestCodeLens.command!.title).to.equal(
      nls.localize('debug_test_title')
    );
    expect(debugTestCodeLens.command!.arguments![0].testName).to.equal(
      'Displays greeting'
    );
  });
});
