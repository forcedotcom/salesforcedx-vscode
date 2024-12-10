/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IsvContextUtil } from '@salesforce/salesforcedx-apex-debugger/out/src/context';
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export const setupGlobalDefaultUserIsvAuth = async () => {
  const isvUtil = new IsvContextUtil();
  if (vscode.workspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
    const isvDebugProject = await isvUtil.setIsvDebuggerContext(vscode.workspace.workspaceFolders[0].uri.fsPath);

    await vscode.commands.executeCommand('setContext', 'sf:isv_debug_project', isvDebugProject);

    const isvDebugMsg = isvDebugProject ? 'Configured ISV Project Authentication' : 'Project is not for ISV Debugger';
    console.log(isvDebugMsg);
  }

  // reset any auth
  isvUtil.resetCliEnvironmentVars();
};

export const registerIsvAuthWatcher = (extensionContext: vscode.ExtensionContext) => {
  if (vscode.workspace.workspaceFolders instanceof Array && vscode.workspace.workspaceFolders.length > 0) {
    const configPath = projectPaths.salesforceProjectConfig();
    const isvAuthWatcher = vscode.workspace.createFileSystemWatcher(configPath);

    isvAuthWatcher.onDidChange(uri => setupGlobalDefaultUserIsvAuth());
    isvAuthWatcher.onDidCreate(uri => setupGlobalDefaultUserIsvAuth());
    isvAuthWatcher.onDidDelete(uri => setupGlobalDefaultUserIsvAuth());

    extensionContext.subscriptions.push(isvAuthWatcher);
  }
};
