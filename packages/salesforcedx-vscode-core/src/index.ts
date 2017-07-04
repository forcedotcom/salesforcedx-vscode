import * as vscode from 'vscode';

import * as scratchOrgDecorator from './scratch-org-decorator';
import { CANCEL_EXECUTION_COMMAND, cancelCommandExecution } from './statuses';
import {
  forceApexTestRun,
  forceAuthWebLogin,
  forceOrgCreate,
  forceOrgOpen,
  forceSourcePull,
  forceSourcePush,
  forceSourceStatus,
  forceTaskStop
} from './commands';
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
  const forceApexTestRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.run',
    forceApexTestRun
  );
  const forceTaskStopCmd = vscode.commands.registerCommand(
    'sfdx.force.task.stop',
    forceTaskStop
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
    internalCancelCommandExecution
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log('SFDX CLI Extension Activated');

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
