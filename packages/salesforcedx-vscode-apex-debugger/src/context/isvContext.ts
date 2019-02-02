/*
 * Copyright (c) 2019, salesforce.com, inc.
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

import { ConfigAggregator, ConfigFile } from '@salesforce/core';

export async function setupGlobalDefaultUserIsvAuth() {
  if (
    vscode.workspace.workspaceFolders instanceof Array &&
    vscode.workspace.workspaceFolders.length > 0
  ) {

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath + '/';
    /* const opts = {
      isGlobal: false,
      isState: true,
      rootFolder: rootPath,
      filename: 'sfdx-config.json'
    };
    const aggregator = await ConfigAggregator.create(opts);
    const locals = aggregator.getLocation(ConfigAggregator.Location.LOCAL);

    // Display the default user info
    console.log('devhub', aggregator.getInfo('defaultdevhubusername'));
    console.log('user', aggregator.getInfo('defaultusername'));
    console.log('waaa', aggregator.getPropertyValue('defaultusername')); */

    const myLocalConfig = await ConfigFile.create({
      isGlobal: false,
      rootFolder: rootPath + '.sfdx/',
      filename: 'sfdx-config.json'
    });

    await myLocalConfig.read();
    const content = myLocalConfig.getContents();
    const obj = myLocalConfig.toObject();
    console.log('content', content);
    console.log('obj', obj);
    console.log('myConfig', myLocalConfig);
    content['myVar'] = 'wwaaaaaaaa';
    // doing this write creates a weird loop
    // myLocalConfig.write(content);

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
