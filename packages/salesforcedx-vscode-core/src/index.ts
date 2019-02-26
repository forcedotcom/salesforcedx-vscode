/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { ConfigurationTarget } from 'vscode';
import { channelService } from './channels';
import {
  CompositeParametersGatherer,
  EmptyParametersGatherer,
  forceAliasList,
  forceApexClassCreate,
  forceApexExecute,
  forceApexLogGet,
  forceApexTestClassRunCodeAction,
  forceApexTestClassRunCodeActionDelegate,
  forceApexTestMethodRunCodeAction,
  forceApexTestMethodRunCodeActionDelegate,
  forceApexTestRun,
  ForceApexTestRunCodeActionExecutor,
  forceApexTriggerCreate,
  forceAuthDevHub,
  forceAuthLogoutAll,
  forceAuthWebLogin,
  forceConfigList,
  forceConfigSet,
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
  forceSourceDelete,
  forceSourceDeployManifest,
  forceSourceDeployMultipleSourcePaths,
  forceSourceDeploySourcePath,
  forceSourcePull,
  forceSourcePush,
  forceSourceRetrieveManifest,
  forceSourceRetrieveSourcePath,
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
import { initSObjectDefinitions } from './commands/forceGenerateFauxClasses';
import { getUserId } from './commands/forceStartApexDebugLogging';
import { isvDebugBootstrap } from './commands/isvdebugging/bootstrapCmd';
import {
  CLIENT_ID,
  SFDX_CLIENT_ENV_VAR,
  TERMINAL_INTEGRATED_ENVS
} from './constants';
import {
  registerDefaultUsernameWatcher,
  setupWorkspaceOrgType
} from './context';
import * as decorators from './decorators';
import { isDemoMode } from './modes/demo-mode';
import { notificationService, ProgressNotification } from './notifications';
import { setDefaultOrg, showDefaultOrg } from './orgPicker';
import { registerPushOrDeployOnSave, sfdxCoreSettings } from './settings';
import { SfdxProjectPath } from './sfdxProject';
import { taskViewService } from './statuses';
import { telemetryService } from './telemetry';
import { isCLIInstalled, showCLINotInstalledMessage } from './util';

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
  const forceSourceDeleteCmd = vscode.commands.registerCommand(
    'sfdx.force.source.delete',
    forceSourceDelete
  );
  const forceSourceDeleteCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.delete.current.file',
    forceSourceDelete
  );
  const forceSourceDeployCurrentSourceFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.current.source.file',
    forceSourceDeploySourcePath
  );
  const forceSourceDeployInManifestCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.in.manifest',
    forceSourceDeployManifest
  );
  const forceSourceDeployMultipleSourcePathsCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.multiple.source.paths',
    forceSourceDeployMultipleSourcePaths
  );
  const forceSourceDeploySourcePathCmd = vscode.commands.registerCommand(
    'sfdx.force.source.deploy.source.path',
    forceSourceDeploySourcePath
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
    'sfdx.force.source.retrieve.source.path',
    forceSourceRetrieveSourcePath
  );
  const forceSourceRetrieveCurrentFileCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.current.source.file',
    forceSourceRetrieveSourcePath
  );
  const forceSourceRetrieveInManifestCmd = vscode.commands.registerCommand(
    'sfdx.force.source.retrieve.in.manifest',
    forceSourceRetrieveManifest
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

  const forceSetDefaultOrgCmd = vscode.commands.registerCommand(
    'sfdx.force.set.default.org',
    setDefaultOrg
  );
  const forceConfigSetCmd = vscode.commands.registerCommand(
    'sfdx.force.config.set',
    forceConfigSet
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
    forceSourceDeleteCmd,
    forceSourceDeleteCurrentFileCmd,
    forceSourceDeployCurrentSourceFileCmd,
    forceSourceDeployInManifestCmd,
    forceSourceDeployMultipleSourcePathsCmd,
    forceSourceDeploySourcePathCmd,
    forceSourcePullCmd,
    forceSourcePullForceCmd,
    forceSourcePushCmd,
    forceSourcePushForceCmd,
    forceSourceRetrieveCmd,
    forceSourceRetrieveCurrentFileCmd,
    forceSourceRetrieveInManifestCmd,
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
    forceApexLogGetCmd,
    forceSetDefaultOrgCmd,
    forceConfigSetCmd
  );
}

export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();
  // Telemetry
  const machineId =
    vscode && vscode.env ? vscode.env.machineId : 'someValue.machineId';
  telemetryService.initializeService(context, machineId);
  telemetryService.showTelemetryMessage();

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

  if (isCLIInstalled()) {
    // Set context for defaultusername org
    await setupWorkspaceOrgType();
    registerDefaultUsernameWatcher(context);

    await showDefaultOrg();
  } else {
    showCLINotInstalledMessage();
  }

  // Register filewatcher for push or deploy on save
  await registerPushOrDeployOnSave();
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

  // Refresh SObject definitions if there aren't any faux classes
  if (sfdxCoreSettings.getEnableSObjectRefreshOnStartup()) {
    initSObjectDefinitions(SfdxProjectPath.getPath()).catch(e =>
      telemetryService.sendErrorEvent(e.message, e.stack)
    );
  }

  const api: any = {
    ProgressNotification,
    CompositeParametersGatherer,
    EmptyParametersGatherer,
    ForceApexTestRunCodeActionExecutor,
    SelectFileName,
    SelectStrictDirPath,
    SfdxCommandlet,
    SfdxCommandletExecutor,
    sfdxCoreSettings,
    SfdxWorkspaceChecker,
    channelService,
    notificationService,
    taskViewService,
    telemetryService,
    getUserId
  };

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
  console.log('SFDX CLI Extension Activated');
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
