/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import { getSObjectsFolderPath } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/utils';
import * as path from 'path';
import { ConfigurationTarget } from 'vscode';
import * as vscode from 'vscode';
import { channelService } from './channels';
import {
  CompositeParametersGatherer,
  forceAliasList,
  forceApexClassCreate,
  forceApexExecute,
  forceApexLogGet,
  forceApexTestClassRunCodeAction,
  forceApexTestClassRunCodeActionDelegate,
  forceApexTestMethodRunCodeAction,
  forceApexTestMethodRunCodeActionDelegate,
  forceApexTestRun,
  forceApexTriggerCreate,
  forceAuthLogoutAll,
  forceAuthWebLogin,
  forceConfigList,
  forceDataSoqlQuery,
  forceDebuggerStop,
  forceGenerateFauxClassesCreate,
  forceLightningAppCreate,
  forceLightningComponentCreate,
  forceLightningEventCreate,
  forceLightningInterfaceCreate,
  forceOpenSObjectNode,
  forceOrgCreate,
  forceOrgDisplay,
  forceOrgOpen,
  forceProjectCreate,
  forceSourcePull,
  forceSourcePush,
  forceSourceStatus,
  forceStartApexDebugLogging,
  forceStopApexDebugLogging,
  forceTaskStop,
  forceVisualforceComponentCreate,
  forceVisualforcePageCreate,
  restoreDebugLevels,
  SelectFileName,
  SelectStrictDirPath,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import { isvDebugBootstrap } from './commands/isvdebugging/bootstrapCmd';
import {
  CLIENT_ID,
  SFDX_CLIENT_ENV_VAR,
  TERMINAL_INTEGRATED_ENVS
} from './constants';
import * as decorators from './decorators';
import { isDemoMode } from './modes/demo-mode';
import { notificationService } from './notifications';
import { CANCEL_EXECUTION_COMMAND, cancelCommandExecution } from './statuses';
import { CancellableStatusBar, taskViewService } from './statuses';
import { SObjectService } from './ui';

function registerCommands(): vscode.Disposable {
  // Customer-facing commands
  const forceAuthWebLoginCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.web.login',
    forceAuthWebLogin
  );
  const forceAuthLogoutAllCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.logout.all',
    forceAuthLogoutAll
  );
  const forceOpenSObjectNodeCmd = vscode.commands.registerCommand(
    'sfdx.force.internal.opensobjectnode',
    forceOpenSObjectNode
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
  const forceSourcePullForceCmd = vscode.commands.registerCommand(
    'sfdx.force.source.pull.force',
    forceSourcePull,
    { flag: '--forceoverwrite' }
  );
  const forceSourcePushCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push',
    forceSourcePush
  );
  const forceSourcePushForceCmd = vscode.commands.registerCommand(
    'sfdx.force.source.push.force',
    forceSourcePush,
    { flag: '--forceoverwrite' }
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
  const forceApexTestClassRunDelegateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.class.run.delegate',
    forceApexTestClassRunCodeActionDelegate
  );
  const forceApexTestLastClassRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.last.class.run',
    forceApexTestClassRunCodeAction
  );
  const forceApexTestClassRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.class.run',
    forceApexTestClassRunCodeAction
  );
  const forceApexTestMethodRunDelegateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.method.run.delegate',
    forceApexTestMethodRunCodeActionDelegate
  );
  const forceApexTestLastMethodRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.last.method.run',
    forceApexTestMethodRunCodeAction
  );
  const forceApexTestMethodRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.method.run',
    forceApexTestMethodRunCodeAction
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
  const forceOrgDisplayUsernameCmd = vscode.commands.registerCommand(
    'sfdx.force.org.display.username',
    forceOrgDisplay,
    { flag: '--targetusername' }
  );
  const forceDataSoqlQueryInputCmd = vscode.commands.registerCommand(
    'sfdx.force.data.soql.query.input',
    forceDataSoqlQuery
  );
  const forceDataSoqlQuerySelectionCmd = vscode.commands.registerCommand(
    'sfdx.force.data.soql.query.selection',
    forceDataSoqlQuery
  );

  const forceGenerateFauxClassesCmd = vscode.commands.registerCommand(
    'sfdx.force.internal.refreshsobjects',
    forceGenerateFauxClassesCreate
  );

  const forceApexExecuteDocumentCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.execute.document',
    forceApexExecute,
    false
  );
  const forceApexExecuteSelectionCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.execute.selection',
    forceApexExecute,
    true
  );

  const forceProjectCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.project.create',
    forceProjectCreate
  );

  const forceApexTriggerCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.trigger.create',
    forceApexTriggerCreate
  );

  const forceStartApexDebugLoggingCmd = vscode.commands.registerCommand(
    'sfdx.force.start.apex.debug.logging',
    forceStartApexDebugLogging
  );

  const forceStopApexDebugLoggingCmd = vscode.commands.registerCommand(
    'sfdx.force.stop.apex.debug.logging',
    forceStopApexDebugLogging
  );

  const isvDebugBootstrapCmd = vscode.commands.registerCommand(
    'sfdx.debug.isv.bootstrap',
    isvDebugBootstrap
  );

  const forceApexLogGetCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.log.get',
    forceApexLogGet
  );

  // Internal commands
  const internalCancelCommandExecution = vscode.commands.registerCommand(
    CANCEL_EXECUTION_COMMAND,
    cancelCommandExecution
  );

  return vscode.Disposable.from(
    forceApexExecuteDocumentCmd,
    forceApexExecuteSelectionCmd,
    forceApexTestRunCmd,
    forceApexTestLastClassRunCmd,
    forceApexTestClassRunCmd,
    forceApexTestClassRunDelegateCmd,
    forceApexTestLastMethodRunCmd,
    forceApexTestMethodRunCmd,
    forceApexTestMethodRunDelegateCmd,
    forceAuthWebLoginCmd,
    forceAuthLogoutAllCmd,
    forceDataSoqlQueryInputCmd,
    forceDataSoqlQuerySelectionCmd,
    forceOpenSObjectNodeCmd,
    forceOrgCreateCmd,
    forceOrgOpenCmd,
    forceSourcePullCmd,
    forceSourcePullForceCmd,
    forceSourcePushCmd,
    forceSourcePushForceCmd,
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
    forceOrgDisplayUsernameCmd,
    forceGenerateFauxClassesCmd,
    forceProjectCreateCmd,
    forceApexTriggerCreateCmd,
    forceStartApexDebugLoggingCmd,
    forceStopApexDebugLoggingCmd,
    isvDebugBootstrapCmd,
    forceApexLogGetCmd,
    internalCancelCommandExecution
  );
}

function registerSObjectExplorer(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const sObjectService = new SObjectService(context);

  // SObject Tree View
  const forceSObjectExplorerTree = vscode.window.registerTreeDataProvider(
    'sfdx.force.sobjectexplorer',
    sObjectService
  );

  // Text Document Provider
  const forceSOBjectTextDoc = vscode.workspace.registerTextDocumentContentProvider(
    'sobject',
    sObjectService
  );

  // SObject Tree View Watcher
  const sobjectPath = getSObjectsFolderPath(
    vscode.workspace.rootPath as string,
    SObjectCategory.ALL
  );
  const sobjectWatcher = vscode.workspace.createFileSystemWatcher(
    path.join(sobjectPath, '**/*.cls')
  );
  sobjectWatcher.onDidDelete(e => sObjectService.refresh());
  sobjectWatcher.onDidCreate(e => sObjectService.refresh());
  sobjectWatcher.onDidChange(e => sObjectService.refresh());

  return vscode.Disposable.from(
    forceSObjectExplorerTree,
    forceSOBjectTextDoc,
    sobjectWatcher
  );
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('SFDX CLI Extension Activated');

  // Context
  let sfdxProjectOpened = false;
  if (vscode.workspace.rootPath) {
    const files = await vscode.workspace.findFiles('**/sfdx-project.json');
    sfdxProjectOpened = files && files.length > 0;
  }

  let replayDebuggerExtensionInstalled = false;
  if (
    vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-replay-debugger'
    )
  ) {
    replayDebuggerExtensionInstalled = true;
  }
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:replay_debugger_extension',
    replayDebuggerExtensionInstalled
  );

  // Set environment variable to add logging for VSCode API calls
  process.env[SFDX_CLIENT_ENV_VAR] = CLIENT_ID;
  const config = vscode.workspace.getConfiguration();

  TERMINAL_INTEGRATED_ENVS.forEach(env => {
    const section: { [k: string]: any } = config.get(env)!;
    section[SFDX_CLIENT_ENV_VAR] = CLIENT_ID;
    config.update(env, section, ConfigurationTarget.Workspace);
  });

  vscode.commands.executeCommand(
    'setContext',
    'sfdx:project_opened',
    sfdxProjectOpened
  );

  const sfdxApexDebuggerExtension = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-apex-debugger'
  );
  vscode.commands.executeCommand(
    'setContext',
    'sfdx:apex_debug_extension_installed',
    sfdxApexDebuggerExtension && sfdxApexDebuggerExtension.id
  );

  // Commands
  const commands = registerCommands();
  context.subscriptions.push(commands);

  // SObjectExplorer
  const sObjectExplorer = registerSObjectExplorer(context);
  context.subscriptions.push(sObjectExplorer);

  // Task View
  const treeDataProvider = vscode.window.registerTreeDataProvider(
    'sfdx.force.tasks.view',
    taskViewService
  );
  context.subscriptions.push(treeDataProvider);

  // Scratch Org Decorator
  if (vscode.workspace.rootPath) {
    decorators.showOrg();
    decorators.monitorOrgConfigChanges();
  }

  // Demo mode Decorator
  if (vscode.workspace.rootPath && isDemoMode()) {
    decorators.showDemoMode();
  }

  const api: any = {
    CancellableStatusBar,
    CompositeParametersGatherer,
    SelectFileName,
    SelectStrictDirPath,
    SfdxCommandlet,
    SfdxCommandletExecutor,
    SfdxWorkspaceChecker,
    channelService,
    notificationService,
    taskViewService
  };

  return api;
}

export function deactivate(): Promise<void> {
  console.log('SFDX CLI Extension Deactivated');

  decorators.disposeTraceFlagExpiration();
  return restoreDebugLevels();
}
