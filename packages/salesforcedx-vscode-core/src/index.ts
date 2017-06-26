import * as vscode from 'vscode';

import * as scratchOrgDecorator from './scratch-org-decorator';
import * as commands from './commands';

function registerCommands(): vscode.Disposable {
  const forceAuthWebLoginCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.web.login',
    commands.forceAuthWebLogin
  );
  const forceOrgCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.org.create',
    commands.forceOrgCreate
  );
  const forceOrgOpenCmd = vscode.commands.registerCommand(
    'sfdx.force.org.open',
    commands.forceOrgOpen
  );
  const forceSourcePullCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull',
    commands.forceSourcePull
  );
  const forceSourcePushCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push',
    commands.forceSourcePush
  );
  const forceSourceStatusCmd = vscode.commands.registerCommand(
    'sfdx.force.source.status',
    commands.forceSourceStatus
  );
  const forceApexTestRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.run',
    commands.forceApexTestRun
  );
  return vscode.Disposable.from(
    forceAuthWebLoginCmd,
    forceOrgCreateCmd,
    forceOrgOpenCmd,
    forceSourcePullCmd,
    forceSourcePushCmd,
    forceSourceStatusCmd,
    forceApexTestRunCmd
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log('SFDX CLI Extension Activated');
  const commands = registerCommands();
  context.subscriptions.push(commands);
  scratchOrgDecorator.showOrg();
  scratchOrgDecorator.monitorConfigChanges();
}

export function deactivate() {
  console.log('SFDX CLI Extension Deactivated');
}
