/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IsvContextUtil } from '@salesforce/salesforcedx-apex-debugger/out/src/context';
import * as vscode from 'vscode';

export async function setupGlobalDefaultUserIsvAuth() {
  const isvUtil = new IsvContextUtil();
  if (
    vscode.workspace &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0]
  ) {
    const isvDebugProject = await isvUtil.setIsvDebuggerContext(
      vscode.workspace.workspaceFolders[0].uri.fsPath
    );

    vscode.commands.executeCommand(
      'setContext',
      'sfdx:isv_debug_project',
      isvDebugProject
    );

    const isvDebugMsg = isvDebugProject
      ? 'Configured ISV Project Authentication'
      : 'Project is not for ISV Debugger';
    console.log(isvDebugMsg);
  }

  // reset any auth
  isvUtil.resetCliEnvironmentVars();
}
