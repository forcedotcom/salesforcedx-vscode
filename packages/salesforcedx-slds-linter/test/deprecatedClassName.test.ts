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

  before(async () => {

    if (vscode.workspace.rootPath) {
      res = await vscode.workspace.findFiles(path.normalize('**/*.cmp'));
      await vscode.workspace.openTextDocument(res[0]).then(
        document => vscode.window.showTextDocument(document)
      );
    }
  });

  it('Should create deprecatedClassName command', async () => {
    const commandList = await vscode.commands.getCommands(true);
    expect(commandList).to.include('deprecatedClassName');
  });
});
