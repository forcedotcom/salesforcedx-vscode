/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator } from '@salesforce/core/configAggregator';
import { SF_CONFIG_ISV_DEBUGGER_SID, SF_CONFIG_ISV_DEBUGGER_URL } from '@salesforce/salesforcedx-utils';
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

export const setupGlobalDefaultUserIsvAuth = async () => {
  if (vscode.workspace?.workspaceFolders?.[0]) {
    const configAggregator: ConfigAggregator = await ConfigAggregator.create({
      projectPath: vscode.workspace?.workspaceFolders?.[0].uri.fsPath
    });
    const isvDebuggerSid = configAggregator.getPropertyValue<string>(SF_CONFIG_ISV_DEBUGGER_SID);
    const isvDebuggerUrl = configAggregator.getPropertyValue<string>(SF_CONFIG_ISV_DEBUGGER_URL);

    const isIsvDebugProject = isvDebuggerSid && isvDebuggerUrl ? true : false;

    await vscode.commands.executeCommand('setContext', 'sf:isv_debug_project', isIsvDebugProject);

    const isvDebugMsg = isIsvDebugProject ? 'Configured ISV Project Authentication' : 'Project is not for ISV Debugger';
    console.log(isvDebugMsg);
  }
};

export const registerIsvAuthWatcher = (extensionContext: vscode.ExtensionContext) => {
  if (Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0) {
    const configPath = projectPaths.salesforceProjectConfig();
    const isvAuthWatcher = vscode.workspace.createFileSystemWatcher(configPath);

    isvAuthWatcher.onDidChange(() => setupGlobalDefaultUserIsvAuth());
    isvAuthWatcher.onDidCreate(() => setupGlobalDefaultUserIsvAuth());
    isvAuthWatcher.onDidDelete(() => setupGlobalDefaultUserIsvAuth());

    extensionContext.subscriptions.push(isvAuthWatcher);
  }
};
