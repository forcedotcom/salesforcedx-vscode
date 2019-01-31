/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as vscode from 'vscode';
import { SfdxProjectPath } from '../../../src/sfdxProject';

describe('Sfdx Project Path', () => {
  it('should return the workspace path', () => {
    expect(SfdxProjectPath.getPath()).to.equal(
      vscode.workspace!.workspaceFolders![0].uri.fsPath
    );
  });
});
