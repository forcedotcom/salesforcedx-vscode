/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

describe('SLDS Deprecated Class Name', () => {
  let res: vscode.Uri[];
  let coreExtension: vscode.Extension<any>;
  let lightningExtension: vscode.Extension<any>;

  before(async () => {
    if (vscode.workspace.workspaceFolders![0]) {
      coreExtension = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-core'
      ) as vscode.Extension<any>;

      lightningExtension = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-lightning'
      ) as vscode.Extension<any>;
    }
  });

  it('coreExtension activation', async function() {
    // tslint:disable-next-line:no-invalid-this
    this.timeout(10000);
    await coreExtension.activate();
    expect(coreExtension.isActive);
  });

  it('lightningExtension activation', async () => {
    await lightningExtension.activate();
    expect(lightningExtension.isActive);
  });

  it('Should create SFDX fix deprecated class command', async () => {
    expect(lightningExtension.isActive);

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
