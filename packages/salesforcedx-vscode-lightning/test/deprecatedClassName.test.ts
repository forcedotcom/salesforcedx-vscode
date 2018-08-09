/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

describe('SLDS Deprecated Class Name', () => {
  let res: vscode.Uri[];
  let lightningExtension: vscode.Extension<any>;

  before(async () => {
    if (vscode.workspace.rootPath) {
      lightningExtension = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-lightning'
      ) as vscode.Extension<any>;
    }
  });

  it('Should create SFDX fix deprecated class command', async () => {
    if (lightningExtension && !lightningExtension.isActive) {
      await lightningExtension.activate();
    }
    res = await vscode.workspace.findFiles(
      path.join('**', 'DemoComponent.cmp')
    );
    await vscode.workspace
      .openTextDocument(res[0])
      .then(document => vscode.window.showTextDocument(document));

    const commandList = await vscode.commands.getCommands(true);
    expect(commandList).to.include(
      'sfdx.force.lightning.slds.fix.deprecated.class'
    );
  });

  after(async () => {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
