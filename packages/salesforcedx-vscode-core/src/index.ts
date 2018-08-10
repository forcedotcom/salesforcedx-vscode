/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';
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
  forceAuthDevHub,
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
  forceOrgCreate,
  forceOrgDisplay,
  forceOrgOpen,
  forceProjectWithManifestCreate,
  forceSfdxProjectCreate,
  forceSourceDeploy,
  forceSourcePull,
  forceSourcePush,
  forceSourceRetrieve,
  forceSourceStatus,
  forceStartApexDebugLogging,
  forceStopApexDebugLogging,
  forceTaskStop,
  forceVisualforceComponentCreate,
  forceVisualforcePageCreate,
  SelectFileName,
  SelectStrictDirPath,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  turnOffLogging
} from './commands';
import { getUserId } from './commands/forceStartApexDebugLogging';
import {
  isvDebugBootstrap,
  setupGlobalDefaultUserIsvAuth
} from './commands/isvdebugging/bootstrapCmd';
import {
  CLIENT_ID,
  SFDX_CLIENT_ENV_VAR,
  TERMINAL_INTEGRATED_ENVS
} from './constants';
import * as decorators from './decorators';
import { nls } from './messages';
import { isDemoMode } from './modes/demo-mode';
import { notificationService, ProgressNotification } from './notifications';
import { taskViewService } from './statuses';
import { telemetryService } from './telemetry';

function registerCommands(
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  // Customer-facing commands
  const forceAuthWebLoginCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.web.login',
    forceAuthWebLogin
  );
  const forceAuthDevHubCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.dev.hub',
    forceAuthDevHub
  );
  const forceAuthLogoutAllCmd = vscode.commands.registerCommand(
    'sfdx.force.auth.logout.all',
    forceAuthLogoutAll
  );
  const forceOrgCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.org.create',
    forceOrgCreate
  );
  const forceOrgOpenCmd = vscode.commands.registerCommand(
    'sfdx.force.org.open',
    forceOrgOpen
  );
  const forceSourceDeployCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy',
    forceSourceDeploy
  );
  const forceSourceDeployCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.current.file',
    forceSourceDeploy
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
  const forceSourceRetrieveCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve',
    forceSourceRetrieve
  );
  const forceSourceRetrieveCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.current.file',
    forceSourceRetrieve
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
    forceSfdxProjectCreate
  );

  const forceProjectWithManifestCreateCmd = vscode.commands.registerCommand(
    'sfdx.force.project.with.manifest.create',
    forceProjectWithManifestCreate
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
    forceAuthDevHubCmd,
    forceAuthLogoutAllCmd,
    forceDataSoqlQueryInputCmd,
    forceDataSoqlQuerySelectionCmd,
    forceOrgCreateCmd,
    forceOrgOpenCmd,
    forceSourceDeployCmd,
    forceSourceDeployCurrentFileCmd,
    forceSourcePullCmd,
    forceSourcePullForceCmd,
    forceSourcePushCmd,
    forceSourcePushForceCmd,
    forceSourceRetrieveCmd,
    forceSourceRetrieveCurrentFileCmd,
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
    forceProjectWithManifestCreateCmd,
    forceApexTriggerCreateCmd,
    forceStartApexDebugLoggingCmd,
    forceStopApexDebugLoggingCmd,
    isvDebugBootstrapCmd,
    forceApexLogGetCmd
  );
}

function registerIsvAuthWatcher(): vscode.Disposable {
  const isvAuthWatcher = vscode.workspace.createFileSystemWatcher(
    path.join('.sfdx', 'sfdx-config.json')
  );
  isvAuthWatcher.onDidChange(uri => setupGlobalDefaultUserIsvAuth());
  isvAuthWatcher.onDidCreate(uri => setupGlobalDefaultUserIsvAuth());
  isvAuthWatcher.onDidDelete(uri => setupGlobalDefaultUserIsvAuth());
  return vscode.Disposable.from(isvAuthWatcher);
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('SFDX CLI Extension Activated');

  // Telemetry
  telemetryService.initializeService(context);
  telemetryService.showTelemetryMessage();
  telemetryService.sendExtensionActivationEvent();

  // Context
  let sfdxProjectOpened = false;
  if (vscode.workspace.rootPath) {
    const files = await vscode.workspace.findFiles('**/sfdx-project.json');
    sfdxProjectOpened = files && files.length > 0;
  }

  let replayDebuggerExtensionInstalled = false;
  if (
    vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-apex-replay-debugger'
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
  if (
    sfdxProjectOpened &&
    sfdxApexDebuggerExtension &&
    sfdxApexDebuggerExtension.id
  ) {
    console.log('Setting up ISV Debugger environment variables');
    // register watcher for ISV authentication and setup default user for CLI
    // this is done in core because it shares access to GlobalCliEnvironment with the commands
    // (VS Code does not seem to allow sharing npm modules between extensions)
    try {
      context.subscriptions.push(registerIsvAuthWatcher());
      console.log('Configured file watcher for .sfdx/sfdx-config.json');
      await setupGlobalDefaultUserIsvAuth();
    } catch (e) {
      console.error(e);
      vscode.window.showWarningMessage(
        nls.localize('isv_debug_config_environment_error')
      );
    }
  }

  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands);

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
    ProgressNotification,
    CompositeParametersGatherer,
    SelectFileName,
    SelectStrictDirPath,
    SfdxCommandlet,
    SfdxCommandletExecutor,
    SfdxWorkspaceChecker,
    channelService,
    notificationService,
    taskViewService,
    telemetryService,
    getUserId
  };

  return api;
}

export function deactivate(): Promise<void> {
  console.log('SFDX CLI Extension Deactivated');

  // Send metric data.
  telemetryService.sendExtensionDeactivationEvent();
  telemetryService.dispose();

  decorators.disposeTraceFlagExpiration();
  return turnOffLogging();
}
