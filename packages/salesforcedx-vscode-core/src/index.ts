/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

import {
  forceAliasList,
  forceApexClassCreate,
  forceApexTestRun,
  forceAuthWebLogin,
  forceConfigList,
  forceDebuggerStop,
  forceLightningAppCreate,
  forceLightningComponentCreate,
  forceLightningEventCreate,
  forceLightningInterfaceCreate,
  forceOrgCreate,
  forceOrgDisplay,
  forceOrgOpen,
  forceSourcePull,
  forceSourcePush,
  forceSourceStatus,
  forceTaskStop,
  forceVisualforceComponentCreate,
  forceVisualforcePageCreate
} from './commands';
import * as scratchOrgDecorator from './scratch-org-decorator';
import { CANCEL_EXECUTION_COMMAND, cancelCommandExecution } from './statuses';
import { taskViewService } from './statuses';

function registerCommands(): vscode.Disposable {
  // Customer-facing commands
  const forceAuthWebLoginCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.web.login',
    forceAuthWebLogin
  );
  const forceOrgCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.org.create',
    forceOrgCreate
  );
  const forceOrgOpenCmd = vscode.commands.registerCommand(
    'sfdx.force.org.open',
    forceOrgOpen
  );
  const forceSourcePullCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull',
    forceSourcePull
  );
  const forceSourcePushCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push',
    forceSourcePush
  );
  const forceSourceStatusCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status',
    forceSourceStatus
  );
  const forceSourceStatusLocalCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status.local',
    forceSourceStatus,
    { flag: '--local' }
  );
  const forceSourceStatusRemoteCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status.remote',
    forceSourceStatus,
    { flag: '--remote' }
  );
  const forceApexTestRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.run',
    forceApexTestRun
  );
  const forceTaskStopCmd = vscode.commands.registerCommand(
    'sfdx.force.task.stop',
    forceTaskStop
  );
  const forceApexClassCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.class.create',
    forceApexClassCreate
  );
  const forceVisualforceComponentCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.visualforce.component.create',
    forceVisualforceComponentCreate
  );
  const forceVisualforcePageCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.visualforce.page.create',
    forceVisualforcePageCreate
  );
  const forceLightningAppCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.app.create',
    forceLightningAppCreate
  );
  const forceLightningComponentCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.component.create',
    forceLightningComponentCreate
  );
  const forceLightningEventCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.event.create',
    forceLightningEventCreate
  );
  const forceLightningInterfaceCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.lightning.interface.create',
    forceLightningInterfaceCreate
  );
  const forceDebuggerStopCmd = vscode.commands.registerCommand(
    'sfdx.force.debugger.stop',
    forceDebuggerStop
  );
  const forceConfigListCmd = vscode.commands.registerCommand(
    'sfdx.force.config.list',
    forceConfigList
  );
  const forceAliasListCmd = vscode.commands.registerCommand(
    'sfdx.force.alias.list',
    forceAliasList
  );
  const forceOrgDisplayDefaultCmd = vscode.commands.registerCommand(
    'sfdx.force.org.display.default',
    forceOrgDisplay
  );

  // Internal commands
  const internalCancelCommandExecution = vscode.commands.registerCommand(
    CANCEL_EXECUTION_COMMAND,
    cancelCommandExecution
  );

  return vscode.Disposable.from(
    forceApexTestRunCmd,
    forceAuthWebLoginCmd,
    forceOrgCreateCmd,
    forceOrgOpenCmd,
    forceSourcePullCmd,
    forceSourcePushCmd,
    forceSourceStatusCmd,
    forceTaskStopCmd,
    forceApexClassCreateCmd,
    forceVisualforceComponentCreateCmd,
    forceVisualforcePageCreateCmd,
    forceLightningAppCreateCmd,
    forceLightningComponentCreateCmd,
    forceLightningEventCreateCmd,
    forceLightningInterfaceCreateCmd,
    forceSourceStatusLocalCmd,
    forceSourceStatusRemoteCmd,
    forceDebuggerStopCmd,
    forceConfigListCmd,
    forceAliasListCmd,
    forceOrgDisplayDefaultCmd,
    internalCancelCommandExecution
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log('SFDX CLI Extension Activated');

  // Context
  vscode.commands.executeCommand('setContext', 'sfdx:project_opened', true);

  // Commands
  const commands = registerCommands();
  context.subscriptions.push(commands);

  // Task View
  const treeDataProvider = vscode.window.registerTreeDataProvider(
    'sfdx.force.tasks.view',
    taskViewService
  );
  context.subscriptions.push(treeDataProvider);

  // Scratch Org Decorator
  scratchOrgDecorator.showOrg();
  scratchOrgDecorator.monitorConfigChanges();
}

export function deactivate() {
  console.log('SFDX CLI Extension Deactivated');
}
