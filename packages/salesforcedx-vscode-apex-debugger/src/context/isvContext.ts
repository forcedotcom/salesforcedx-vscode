/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ENV_SFDX_DEFAULTUSERNAME,
  ENV_SFDX_INSTANCE_URL,
  SFDX_CONFIG_ISV_DEBUGGER_SID,
  SFDX_CONFIG_ISV_DEBUGGER_URL
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  ForceConfigGet,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as vscode from 'vscode';

export async function setupGlobalDefaultUserIsvAuth() {
  if (
    vscode.workspace.workspaceFolders instanceof Array &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    const forceConfig = await new ForceConfigGet().getConfig(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      SFDX_CONFIG_ISV_DEBUGGER_SID,
      SFDX_CONFIG_ISV_DEBUGGER_URL
    );
    const isvDebuggerSid = forceConfig.get(SFDX_CONFIG_ISV_DEBUGGER_SID);
    const isvDebuggerUrl = forceConfig.get(SFDX_CONFIG_ISV_DEBUGGER_URL);
    if (
      typeof isvDebuggerSid !== 'undefined' &&
      typeof isvDebuggerUrl !== 'undefined'
    ) {
      // set auth context
      GlobalCliEnvironment.environmentVariables.set(
        ENV_SFDX_DEFAULTUSERNAME,
        isvDebuggerSid
      );
      GlobalCliEnvironment.environmentVariables.set(
        ENV_SFDX_INSTANCE_URL,
        isvDebuggerUrl
      );
      // enable ISV project
      vscode.commands.executeCommand(
        'setContext',
        'sfdx:isv_debug_project',
        true
      );
      console.log(
        `Configured ${ENV_SFDX_DEFAULTUSERNAME} and ${ENV_SFDX_INSTANCE_URL} for ISV Project Authentication`
      );
      return;
    } else {
      // disable ISV project
      vscode.commands.executeCommand(
        'setContext',
        'sfdx:isv_debug_project',
        false
      );
      console.log('Project is not for ISV Debugger');
    }
  }

  // reset any auth
  GlobalCliEnvironment.environmentVariables.delete(ENV_SFDX_DEFAULTUSERNAME);
  GlobalCliEnvironment.environmentVariables.delete(ENV_SFDX_INSTANCE_URL);
  console.log(
    `Deleted environment variables ${ENV_SFDX_DEFAULTUSERNAME} and ${ENV_SFDX_INSTANCE_URL}`
  );
}
