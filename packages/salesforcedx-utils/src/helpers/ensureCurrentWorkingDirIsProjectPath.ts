/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export const ensureCurrentWorkingDirIsProjectPath = async (rootWorkspacePath: string): Promise<void> => {
  if (rootWorkspacePath && process.cwd() !== rootWorkspacePath) {
    try {
      const uri = vscode.Uri.file(rootWorkspacePath);
      await vscode.workspace.fs.stat(uri);
      process.chdir(rootWorkspacePath);
    } catch (error) {
      // Path doesn't exist, do nothing
    }
  }
};
